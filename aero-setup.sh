#!/bin/bash
# ==============================================================================
# AeroOS Bootstrap & Optimization Script (Sway - Wayland Edition)
# Description: Converts a minimal/standard Ubuntu system into a lightweight,
#              optimized, user-friendly Wayland/Sway desktop for daily usage,
#              productivity, modern web apps, and gaming.
# ==============================================================================

set -euo pipefail

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "[-] Error: Please run this script as root (sudo)."
    exit 1
fi

echo "[+] Starting AeroOS (Sway Wayland Edition) Installation..."

export DEBIAN_FRONTEND=noninteractive
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-resolute}")"

# True when running inside the ISO builder's chroot (never touch the host kernel/firewall there)
in_chroot() {
    command -v ischroot >/dev/null 2>&1 && ischroot
}

# Only add a third-party apt source if it actually publishes this Ubuntu release
url_exists() {
    curl -fsSI --max-time 20 "$1" >/dev/null 2>&1
}

# 0. Live ISO images ship a "file:/cdrom" source that does not exist once extracted.
if grep -rqs 'cdrom' /etc/apt/sources.list /etc/apt/sources.list.d/; then
    echo "[+] Removing live-ISO cdrom apt source and writing clean ${CODENAME} sources..."
    sed -i '/cdrom/d' /etc/apt/sources.list 2>/dev/null || true
    for f in /etc/apt/sources.list.d/*; do
        if [ -f "$f" ] && grep -q 'cdrom' "$f"; then
            rm -f "$f"
        fi
    done
    cat > /etc/apt/sources.list.d/ubuntu.sources <<EOF
Types: deb
URIs: http://archive.ubuntu.com/ubuntu/
Suites: ${CODENAME} ${CODENAME}-updates ${CODENAME}-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://security.ubuntu.com/ubuntu/
Suites: ${CODENAME}-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
fi

# 1. Update and install base prerequisites
echo "[+] Installing core prerequisites..."
apt-get update
apt-get install -y --no-install-recommends software-properties-common curl wget gpg apt-transport-https ca-certificates gnupg lsb-release debianutils

# 2. Add Optimized Repositories (skipped automatically if not published for this release)
echo "[+] Configuring PPA repositories for cutting-edge gaming drivers..."
if url_exists "https://ppa.launchpadcontent.net/kisak/kisak-mesa/ubuntu/dists/${CODENAME}/Release"; then
    add-apt-repository -y ppa:kisak/kisak-mesa
else
    echo "[!] kisak-mesa PPA not available for ${CODENAME}; using archive Mesa."
fi

# WineHQ Repository Setup
WINEHQ_SOURCES="https://dl.winehq.org/wine-builds/ubuntu/dists/${CODENAME}/winehq-${CODENAME}.sources"
WINE_PKG="wine"
if url_exists "${WINEHQ_SOURCES}"; then
    echo "[+] Adding WineHQ repository..."
    mkdir -p /etc/apt/keyrings
    chmod 755 /etc/apt/keyrings
    wget -qO /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key
    wget -qNP /etc/apt/sources.list.d/ "${WINEHQ_SOURCES}"
    WINE_PKG="winehq-stable"
else
    echo "[!] WineHQ not available for ${CODENAME}; using archive Wine."
fi

# 3. Add External Repositories (Brave Browser, VS Code)
echo "[+] Adding Brave Browser repository..."
curl -fsS https://dl.brave.com/install.sh | sh

echo "[+] Adding VS Code repository..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" >/etc/apt/sources.list.d/vscode.list
rm -f packages.microsoft.gpg

# Update all package indices
apt-get update

# 4. Install Sway, Waybar, Wofi, Portals, Audio, Fonts & System Trays
echo "[+] Installing Sway Window Manager & Wayland helpers..."
apt-get install -y --no-install-recommends \
    sway \
    swaybg \
    xwayland \
    waybar \
    wofi \
    swaylock \
    swayidle \
    mako-notifier \
    libnotify-bin \
    xdg-desktop-portal-wlr \
    xdg-desktop-portal-gtk \
    pipewire \
    wireplumber \
    policykit-1-gnome \
    thunar \
    nm-tray \
    network-manager-gnome \
    blueman \
    pamixer \
    brightnessctl \
    grim \
    slurp \
    wl-clipboard \
    pavucontrol \
    kitty \
    sqlite3 \
    aria2 \
    calamares

echo "[+] Installing modern desktop fonts and icon themes..."
apt-get install -y --no-install-recommends \
    fonts-font-awesome \
    fonts-inter \
    fonts-jetbrains-mono \
    fonts-noto-color-emoji \
    papirus-icon-theme || true

# 5. Install Productivity, Useful Daily Tools & Curated Utilities (Lean)
echo "[+] Installing productivity software and curated daily-use utilities..."
apt-get install -y --no-install-recommends \
    brave-browser \
    code \
    libreoffice-calc \
    libreoffice-writer \
    mpv \
    imv \
    gnome-calculator \
    file-roller \
    btop \
    fastfetch \
    ncdu \
    ripgrep \
    fzf \
    git \
    ufw \
    unattended-upgrades \
    gparted \
    flatpak

# 6. Install Gaming Stack & Performance Optimizations
echo "[+] Installing gaming prerequisites (Steam, Wine, Lutris, GameMode, MangoHud)..."
# Enable 32-bit architecture for Wine/Steam
dpkg --add-architecture i386
apt-get update

# Pre-accept the Steam license so the noninteractive install can't stall
echo "steam steam/question select I AGREE" | debconf-set-selections
echo "steam steam/license note ''" | debconf-set-selections
echo "steam-installer steam/question select I AGREE" | debconf-set-selections
echo "steam-installer steam/license note ''" | debconf-set-selections

# Install Wine, GameMode, MangoHud, Lutris (Ubuntu archive) and Steam
apt-get install -y --install-recommends \
    "${WINE_PKG}" \
    winetricks \
    gamemode \
    libgamemode0:i386 \
    mangohud \
    lutris \
    steam-installer

# 7. Apply System & Kernel Optimizations
echo "[+] Deploying kernel tuning parameters..."
if [ -f "./configs/99-aero-performance.conf" ]; then
    cp ./configs/99-aero-performance.conf /etc/sysctl.d/
    # Inside the ISO chroot this would retune the *build host* kernel; it applies on first boot instead.
    if ! in_chroot; then
        sysctl --system || true
    fi
else
    echo "[!] Warning: configs/99-aero-performance.conf not found. Skipping sysctl copy."
fi

if [ -f "./configs/gamemode.ini" ]; then
    mkdir -p /etc/xdg/
    cp ./configs/gamemode.ini /etc/xdg/gamemode.ini
else
    echo "[!] Warning: configs/gamemode.ini not found. Skipping GameMode config copy."
fi

# Enable ZRAM for compressed RAM space (massively improves memory footprint)
echo "[+] Enabling zRAM..."
apt-get install -y --no-install-recommends zram-config

# 8. Visual Customization & Default Skeleton Presets
echo "[+] Setting up user configuration templates (Sway, Waybar, Wofi, Mako, Swaylock, Kitty)..."
mkdir -p /etc/skel/.config/sway \
         /etc/skel/.config/waybar \
         /etc/skel/.config/wofi \
         /etc/skel/.config/mako \
         /etc/skel/.config/swaylock \
         /etc/skel/.config/kitty \
         /etc/skel/.config/aeroos

[ -f "./configs/sway/config" ] && cp "./configs/sway/config" /etc/skel/.config/sway/config
[ -f "./configs/waybar/config" ] && cp "./configs/waybar/config" /etc/skel/.config/waybar/config
[ -f "./configs/kitty/kitty.conf" ] && cp "./configs/kitty/kitty.conf" /etc/skel/.config/kitty/kitty.conf

# Install Chicago95 GTK/Icon Retro theme dependencies for Nostalgia9x
echo "[+] Downloading Chicago95 Retro Icons and Themes..."
mkdir -p /usr/share/themes /usr/share/icons
wget -qO- https://github.com/grassmunk/Chicago95/archive/master.tar.gz | tar -xz -C /tmp/ || true
if [ -d "/tmp/Chicago95-master" ]; then
    cp -r /tmp/Chicago95-master/Theme/Chicago95 /usr/share/themes/ || true
    cp -r /tmp/Chicago95-master/Icons/Chicago95 /usr/share/icons/ || true
    rm -rf /tmp/Chicago95-master
fi

# Copy Theme presets, Wallpapers, and Control Hub web assets
echo "[+] Copying AeroOS themes, wallpapers, and Control Hub web assets..."
mkdir -p /usr/share/aeroos/themes /usr/share/aeroos/wallpapers /usr/share/aeroos/hub /usr/share/aeroos/assets
[ -d "./configs/themes" ] && cp -r ./configs/themes/* /usr/share/aeroos/themes/
[ -d "./configs/wallpapers" ] && cp -r ./configs/wallpapers/* /usr/share/aeroos/wallpapers/
[ -d "./docs/hub" ] && cp -r ./docs/hub/* /usr/share/aeroos/hub/
[ -d "./docs/assets" ] && cp -r ./docs/assets/* /usr/share/aeroos/assets/

# Set up default symlinks for a fresh skeleton user (using Aero Glass as default)
ln -sf /usr/share/aeroos/themes/aero/sway.theme /etc/skel/.config/sway/theme
ln -sf /usr/share/aeroos/themes/aero/waybar.css /etc/skel/.config/waybar/style.css
ln -sf /usr/share/aeroos/themes/aero/wofi.css /etc/skel/.config/wofi/style.css
ln -sf /usr/share/aeroos/themes/aero/mako.conf /etc/skel/.config/mako/config
ln -sf /usr/share/aeroos/themes/aero/swaylock.conf /etc/skel/.config/swaylock/config
ln -sf /usr/share/aeroos/themes/aero/kitty.conf /etc/skel/.config/kitty/theme.conf
echo "aero" > /etc/skel/.config/aeroos/current-theme

# Compile & Install AeroOS Native Tools (Rust: aero-hub & aero-webapp, C++: aero-browser)
echo "[+] Building native AeroOS binaries (Rust, C++)..."
apt-get install -y --no-install-recommends \
    rustc \
    g++ \
    pkg-config \
    qtbase5-dev \
    qtwebengine5-dev

rustc -O src/aero-hub/main.rs -o /usr/local/bin/aero-hub
rustc -O src/aero-webapp/main.rs -o /usr/local/bin/aero-webapp
# shellcheck disable=SC2046
g++ -O2 -std=c++17 -fPIC src/aero-browser/main.cpp -o /usr/local/bin/aero-browser \
    $(pkg-config --cflags --libs Qt5Widgets Qt5WebEngineWidgets)
chmod 755 /usr/local/bin/aero-hub /usr/local/bin/aero-webapp /usr/local/bin/aero-browser

# Pin the shared libraries aero-browser links against so purging the -dev packages keeps them
ldd /usr/local/bin/aero-browser | awk '/=> \// {print $3}' | xargs -r realpath \
    | xargs -r dpkg -S 2>/dev/null | cut -d: -f1 | sort -u | xargs -r apt-mark manual || true

echo "[+] Deploying shell utilities (aero-theme, aero-power)..."
for tool in aero-theme aero-power; do
    if [ -f "./${tool}" ]; then
        cp "./${tool}" "/usr/local/bin/${tool}"
        chmod 755 "/usr/local/bin/${tool}"
    fi
done

# App Center: native GNOME Software with Flatpak/Flathub (no pip / Python runtime needed)
echo "[+] Installing App Center (GNOME Software + Flathub)..."
apt-get install -y --no-install-recommends gnome-software gnome-software-plugin-flatpak
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo || true

for desktop_file in aero-hub.desktop aero-theme.desktop aero-webapp.desktop aero-browser.desktop; do
    if [ -f "./${desktop_file}" ]; then
        cp "./${desktop_file}" "/usr/share/applications/${desktop_file}"
    fi
done

if [ -f "./install-aeroos.desktop" ]; then
    mkdir -p /etc/skel/Desktop
    cp "./install-aeroos.desktop" /etc/skel/Desktop/install-aeroos.desktop
    chmod +x /etc/skel/Desktop/install-aeroos.desktop
    cp "./install-aeroos.desktop" /usr/share/applications/install-aeroos.desktop
fi

# 9. Set Up Wayland Global Environment Variables for optimal gaming and scaling
echo "[+] Configuring global environment variables for Wayland..."
if ! grep -q "AeroOS" /etc/environment 2>/dev/null; then
    cat << 'EOF' >> /etc/environment
# Wayland Environment Optimizations for AeroOS
SDL_VIDEODRIVER=wayland,x11
QT_QPA_PLATFORM="wayland;xcb"
_JAVA_AWT_GTK_LOOKANDFEEL=1
MOZ_ENABLE_WAYLAND=1
ELECTRON_OZONE_PLATFORM_HINT=auto
EOF
fi

# 10. Security Hardening & Minimal Image Cleanup
echo "[+] Hardening system security (UFW default-deny + unattended-upgrades)..."
ufw default deny incoming || true
ufw default allow outgoing || true
ufw limit ssh || true
if in_chroot; then
    # Don't load iptables rules into the build host; just enable UFW for first boot.
    sed -i 's/^ENABLED=.*/ENABLED=yes/' /etc/ufw/ufw.conf || true
else
    ufw --force enable || true
fi
systemctl enable ufw || true
systemctl enable unattended-upgrades || true

echo "[+] Purging build-time compilers and cleaning package caches..."
apt-get purge -y rustc g++ pkg-config qtbase5-dev qtwebengine5-dev || true
apt-get autoremove -y
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/*

echo "[+] ==========================================================="
echo "[+] AeroOS (Sway Wayland) Installation Completed Successfully!"
echo "[+] Please reboot the system to start your new optimized distro."
echo "[+] ==========================================================="
