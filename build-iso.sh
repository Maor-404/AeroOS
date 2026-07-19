#!/bin/bash
# ==============================================================================
# AeroOS Custom ISO Builder
# Description: Automates extracting an Ubuntu ISO, running the aero-setup.sh
#              inside a chroot environment, and compiling the customized ISO.
# ==============================================================================

set -euo pipefail

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
    echo "[-] Error: Please run this script as root (sudo)."
    exit 1
fi

BASE_ISO_URL="https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso"
ISO_NAME="ubuntu-24.04-live-server-amd64.iso"
BUILD_DIR="/tmp/aeroos-build"
ISO_MOUNT="${BUILD_DIR}/mount"
ISO_FILES="${BUILD_DIR}/iso-files"
CHROOT_DIR="${BUILD_DIR}/chroot"
OUTPUT_ISO="aeroos-custom-24.04.iso"

echo "[+] Preparing workspace..."
mkdir -p "${BUILD_DIR}" "${ISO_MOUNT}" "${ISO_FILES}" "${CHROOT_DIR}"

# 1. Download Base ISO if not already present
if [ ! -f "${ISO_NAME}" ]; then
    echo "[+] Downloading base Ubuntu Live Server ISO..."
    wget -O "${ISO_NAME}" "${BASE_ISO_URL}"
else
    echo "[+] Base ISO already present."
fi

# 2. Mount and Extract ISO Content
echo "[+] Mounting base ISO..."
mount -o loop "${ISO_NAME}" "${ISO_MOUNT}"

echo "[+] Extracting ISO filesystem structure..."
rsync -a -H --exclude=/casper/filesystem.squashfs "${ISO_MOUNT}/" "${ISO_FILES}/"

# 3. Extract SquashFS Root Filesystem
echo "[+] Extracting squashfs filesystem (this may take a few minutes)..."
unsquashfs -d "${CHROOT_DIR}" "${ISO_MOUNT}/casper/filesystem.squashfs"
umount "${ISO_MOUNT}"

# 4. Bind mount device filesystems for Chroot
echo "[+] Setting up chroot virtual mounts..."
mount --bind /dev "${CHROOT_DIR}/dev"
mount --bind /run "${CHROOT_DIR}/run"
mount -t devpts devpts "${CHROOT_DIR}/dev/pts"
mount -t proc proc "${CHROOT_DIR}/proc"
mount -t sysfs sysfs "${CHROOT_DIR}/sys"
mount -t tmpfs tmpfs "${CHROOT_DIR}/tmp"
cp /etc/resolv.conf "${CHROOT_DIR}/etc/resolv.conf"

# 5. Copy AeroOS installation scripts into the chroot
echo "[+] Copying customization scripts into chroot..."
mkdir -p "${CHROOT_DIR}/opt/aeroos"
cp -r ./configs "${CHROOT_DIR}/opt/aeroos/"
cp ./aero-setup.sh "${CHROOT_DIR}/opt/aeroos/aero-setup.sh"
chmod +x "${CHROOT_DIR}/opt/aeroos/aero-setup.sh"

# 6. Execute aero-setup.sh in Chroot
echo "[+] Executing customization script inside the chroot environment..."
chroot "${CHROOT_DIR}" /bin/bash -c "cd /opt/aeroos && ./aero-setup.sh"

# Cleanup customization files inside the image
rm -rf "${CHROOT_DIR}/opt/aeroos"

# 7. Unmount Chroot mounts
echo "[+] Cleaning up chroot virtual mounts..."
umount "${CHROOT_DIR}/dev/pts" || true
umount "${CHROOT_DIR}/dev" || true
umount "${CHROOT_DIR}/run" || true
umount "${CHROOT_DIR}/proc" || true
umount "${CHROOT_DIR}/sys" || true
umount "${CHROOT_DIR}/tmp" || true

# 8. Repackage SquashFS
echo "[+] Repackaging squashfs filesystem..."
rm -f "${ISO_FILES}/casper/filesystem.squashfs"
mksquashfs "${CHROOT_DIR}" "${ISO_FILES}/casper/filesystem.squashfs" -comp xz

# 9. Generate Custom Bootable ISO
echo "[+] Creating custom bootable ISO via xorriso..."
xorriso -as mkisofs -r \
  -V "AeroOS_24_04" \
  -o "${OUTPUT_ISO}" \
  -J -joliet-long -l \
  -b boot/grub/i386-pc/eltorito.img \
  -c boot.catalog \
  -no-emul-boot -boot-load-size 4 -boot-info-table \
  -eltorito-alt-boot \
  -e boot/grub/efi.img \
  -no-emul-boot \
  -isohybrid-gpt-basdat \
  "${ISO_FILES}"

echo "[+] Custom ISO successfully created: ${OUTPUT_ISO}"
