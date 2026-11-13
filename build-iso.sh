#!/bin/bash
# ==============================================================================
# AeroOS Custom ISO Builder
# Description: Extracts the root squashfs from the Ubuntu 26.04 LTS live ISO,
#              runs aero-setup.sh inside a chroot, and re-packs a bootable ISO
#              by replaying the original BIOS + UEFI boot records with xorriso.
# ==============================================================================

set -euo pipefail

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
    echo "[-] Error: Please run this script as root (sudo)."
    exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SRC_DIR}"

# Dynamically discover the latest Ubuntu 26.04 LTS point release ISO to prevent 404 errors
echo "[+] Finding the latest Ubuntu 26.04 LTS point release ISO..."
ISO_NAME=$(curl -fsSL https://releases.ubuntu.com/26.04/ \
    | grep -oE 'ubuntu-26\.04(\.[0-9]+)?-live-server-amd64\.iso' | sort -uV | tail -n 1)
if [ -z "${ISO_NAME}" ]; then
    echo "[-] Error: Could not discover an Ubuntu 26.04 live-server ISO."
    exit 1
fi
BASE_ISO_URL="https://releases.ubuntu.com/26.04/${ISO_NAME}"
BUILD_DIR="${AEROOS_BUILD_DIR:-/tmp/aeroos-build}"
ISO_MOUNT="${BUILD_DIR}/mount"
CHROOT_DIR="${BUILD_DIR}/chroot"
NEW_SQUASHFS="${BUILD_DIR}/root.squashfs"
NEW_SIZE_FILE="${BUILD_DIR}/root.size"
OUTPUT_ISO="aeroos-custom-26.04.iso"

cleanup() {
    for m in dev/pts dev run proc sys tmp; do
        umount -lf "${CHROOT_DIR}/${m}" 2>/dev/null || true
    done
    umount -lf "${ISO_MOUNT}" 2>/dev/null || true
}
trap cleanup EXIT

echo "[+] Preparing workspace..."
mkdir -p "${BUILD_DIR}" "${ISO_MOUNT}" "${CHROOT_DIR}"

# 1. Download Base ISO if not already present
if [ ! -f "${ISO_NAME}" ]; then
    echo "[+] Downloading base Ubuntu Live Server ISO (${ISO_NAME})..."
    wget -q --show-progress --progress=dot:giga --tries=10 --timeout=30 --waitretry=5 \
        --retry-connrefused -O "${ISO_NAME}" "${BASE_ISO_URL}"
else
    echo "[+] Base ISO already present."
fi

# 2. Mount base ISO and locate the root squashfs layer (the one containing /bin/bash)
echo "[+] Mounting base ISO..."
mount -o loop,ro "${ISO_NAME}" "${ISO_MOUNT}"

echo "[+] Scanning squashfs layers to find the base root filesystem..."
SQUASHFS_PATH=""
for sq in "${ISO_MOUNT}/casper"/*.squashfs; do
    if unsquashfs -l "$sq" 2>/dev/null | grep -qE '(^|/)(usr/)?bin/bash$'; then
        SQUASHFS_PATH="$sq"
        break
    fi
done

if [ -z "${SQUASHFS_PATH}" ]; then
    echo "[-] Error: Could not find base squashfs containing /bin/bash"
    exit 1
fi

SQUASHFS_NAME=$(basename "${SQUASHFS_PATH}")
SQUASHFS_STEM="${SQUASHFS_NAME%.squashfs}"
echo "[+] Detected root squashfs: ${SQUASHFS_NAME}"

# 3. Extract SquashFS Root Filesystem
echo "[+] Extracting squashfs filesystem (this may take a few minutes)..."
rm -rf "${CHROOT_DIR}"
unsquashfs -no-progress -d "${CHROOT_DIR}" "${SQUASHFS_PATH}"
umount "${ISO_MOUNT}"

# 4. Bind mount device filesystems for Chroot
echo "[+] Setting up chroot virtual mounts..."
mkdir -p "${CHROOT_DIR}/dev" "${CHROOT_DIR}/run" "${CHROOT_DIR}/dev/pts" \
         "${CHROOT_DIR}/proc" "${CHROOT_DIR}/sys" "${CHROOT_DIR}/tmp"
mount --bind /dev "${CHROOT_DIR}/dev"
mount --bind /run "${CHROOT_DIR}/run"
mount -t devpts devpts "${CHROOT_DIR}/dev/pts"
mount -t proc proc "${CHROOT_DIR}/proc"
mount -t sysfs sysfs "${CHROOT_DIR}/sys"
mount -t tmpfs tmpfs "${CHROOT_DIR}/tmp"

# Working DNS inside the chroot (restored to the systemd-resolved stub afterwards)
RESOLV_BACKUP=""
if [ -L "${CHROOT_DIR}/etc/resolv.conf" ]; then
    RESOLV_BACKUP="$(readlink "${CHROOT_DIR}/etc/resolv.conf")"
fi
rm -f "${CHROOT_DIR}/etc/resolv.conf"
printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > "${CHROOT_DIR}/etc/resolv.conf"

# Never start daemons inside the build chroot
cat > "${CHROOT_DIR}/usr/sbin/policy-rc.d" <<'EOF'
#!/bin/sh
exit 101
EOF
chmod +x "${CHROOT_DIR}/usr/sbin/policy-rc.d"

# 5. Copy AeroOS installation scripts and assets into the chroot
echo "[+] Copying customization scripts and assets into chroot..."
mkdir -p "${CHROOT_DIR}/opt/aeroos"
cp -r ./configs ./docs ./src "${CHROOT_DIR}/opt/aeroos/"
cp ./Makefile ./aero-setup.sh ./aero-theme ./aero-power "${CHROOT_DIR}/opt/aeroos/"
cp ./*.desktop "${CHROOT_DIR}/opt/aeroos/"
chmod +x "${CHROOT_DIR}/opt/aeroos/aero-setup.sh" \
         "${CHROOT_DIR}/opt/aeroos/aero-theme" \
         "${CHROOT_DIR}/opt/aeroos/aero-power"

# 6. Execute aero-setup.sh in Chroot
echo "[+] Executing customization script inside the chroot environment..."
chroot "${CHROOT_DIR}" /usr/bin/env -i \
    HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
    /bin/bash -c "cd /opt/aeroos && ./aero-setup.sh"

# Cleanup customization files inside the image
rm -rf "${CHROOT_DIR}/opt/aeroos"
rm -f "${CHROOT_DIR}/usr/sbin/policy-rc.d"
rm -f "${CHROOT_DIR}/etc/resolv.conf"
if [ -n "${RESOLV_BACKUP}" ]; then
    ln -s "${RESOLV_BACKUP}" "${CHROOT_DIR}/etc/resolv.conf"
fi

# 7. Unmount Chroot mounts
echo "[+] Cleaning up chroot virtual mounts..."
cleanup

# 8. Repackage SquashFS
echo "[+] Repackaging squashfs filesystem..."
rm -f "${NEW_SQUASHFS}"
mksquashfs "${CHROOT_DIR}" "${NEW_SQUASHFS}" -comp xz -b 1M -noappend -no-progress
du -sx --block-size=1 "${CHROOT_DIR}" | cut -f1 > "${NEW_SIZE_FILE}"
rm -rf "${CHROOT_DIR}"

# 9. Generate the bootable ISO by replaying the original BIOS + UEFI boot setup
echo "[+] Creating custom bootable ISO via xorriso (boot record replay)..."
rm -f "${OUTPUT_ISO}"
SIZE_MAP=()
if xorriso -indev "${ISO_NAME}" -find "/casper/${SQUASHFS_STEM}.size" 2>/dev/null | grep -q "${SQUASHFS_STEM}.size"; then
    SIZE_MAP=(-map "${NEW_SIZE_FILE}" "/casper/${SQUASHFS_STEM}.size")
fi
xorriso -indev "${ISO_NAME}" \
    -outdev "${OUTPUT_ISO}" \
    -map "${NEW_SQUASHFS}" "/casper/${SQUASHFS_NAME}" \
    "${SIZE_MAP[@]}" \
    -volid "AeroOS_26_04" \
    -boot_image any replay \
    -padding included

rm -f "${NEW_SQUASHFS}" "${NEW_SIZE_FILE}"
echo "[+] Custom ISO successfully created: ${OUTPUT_ISO}"
ls -lh "${OUTPUT_ISO}"
