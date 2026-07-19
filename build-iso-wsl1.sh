#!/bin/bash
# ==============================================================================
# AeroOS WSL 1 Custom ISO Builder
# Description: Uses 7z and PRoot to build the custom ISO without requiring
#              loop-back mounts or kernel-level chroot privileges.
# ==============================================================================

set -euo pipefail

# Dynamically discover the latest Ubuntu 24.04 point release ISO to prevent 404 errors
echo "[+] Finding the latest Ubuntu 24.04 point release ISO..."
ISO_NAME=$(curl -s https://releases.ubuntu.com/24.04/ | grep -oE 'ubuntu-24.04\.[0-9]+-live-server-amd64\.iso' | head -n 1)
BASE_ISO_URL="https://releases.ubuntu.com/24.04/${ISO_NAME}"
BUILD_DIR="/tmp/aeroos-build"
ISO_FILES="${BUILD_DIR}/iso-files"
CHROOT_DIR="${BUILD_DIR}/chroot"
OUTPUT_ISO="aeroos-custom-24.04.iso"

# Check dependencies
for cmd in 7z proot mksquashfs xorriso wget rsync curl; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "[-] Error: '$cmd' is not installed. Please run: sudo apt install p7zip-full proot squashfs-tools xorriso wget rsync curl"
        exit 1
    fi
done

echo "[+] Preparing workspace..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}" "${ISO_FILES}" "${CHROOT_DIR}"

# 1. Download Base ISO if not already present
if [ ! -f "${ISO_NAME}" ]; then
    echo "[+] Downloading base Ubuntu Live Server ISO..."
    wget -O "${ISO_NAME}" "${BASE_ISO_URL}"
else
    echo "[+] Base ISO already present."
fi

# 2. Extract ISO Content using 7z (no loop mount required)
echo "[+] Extracting ISO contents using 7z..."
7z x -y -o"${ISO_FILES}" "${ISO_NAME}" > /dev/null

# 3. Extract SquashFS Root Filesystem
echo "[+] Extracting squashfs filesystem (this may take a few minutes)..."
# Dynamically discover the root squashfs (the largest squashfs in casper)
SQUASHFS_PATH=$(find "${ISO_FILES}/casper" -name "*.squashfs" -printf "%s %p\n" | sort -n | tail -n 1 | cut -d' ' -f2)
SQUASHFS_NAME=$(basename "${SQUASHFS_PATH}")
echo "[+] Detected root squashfs: ${SQUASHFS_NAME}"

unsquashfs -d "${CHROOT_DIR}" "${SQUASHFS_PATH}"

# 4. Copy AeroOS installation scripts into the chroot
echo "[+] Copying customization scripts into chroot..."
mkdir -p "${CHROOT_DIR}/opt/aeroos"
cp -r ./configs "${CHROOT_DIR}/opt/aeroos/"
cp ./aero-setup.sh "${CHROOT_DIR}/opt/aeroos/aero-setup.sh"
chmod +x "${CHROOT_DIR}/opt/aeroos/aero-setup.sh"

# 5. Run customization using PRoot (simulates mount and chroot in user-space)
echo "[+] Running installer script in PRoot..."
# PRoot maps host /dev, /proc, and /sys into the guest filesystem automatically
proot -r "${CHROOT_DIR}" -b /dev -b /proc -b /sys -b /etc/resolv.conf:/etc/resolv.conf \
    /bin/bash -c "cd /opt/aeroos && ./aero-setup.sh"

# Clean up build files inside the target filesystem
rm -rf "${CHROOT_DIR}/opt/aeroos"

# 6. Repackage SquashFS
echo "[+] Repackaging squashfs filesystem..."
rm -f "${ISO_FILES}/casper/${SQUASHFS_NAME}"
mksquashfs "${CHROOT_DIR}" "${ISO_FILES}/casper/${SQUASHFS_NAME}" -comp xz

# 7. Generate Custom Bootable ISO
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
