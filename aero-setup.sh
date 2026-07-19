#!/bin/bash
# ==============================================================================
# AeroOS Bootstrap & Optimization Script (Sway - Wayland Edition)
# Description: Converts a minimal/standard Ubuntu system into a lightweight,
#              optimized, user-friendly Wayland/Sway desktop for daily usage,
#              productivity, and gaming.
# ==============================================================================

set -euo pipefail

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "[-] Error: Please run this script as root (sudo)."
    exit 1
fi

echo "[+] Starting AeroOS (Sway Wayland Edition) Installation..."

# 1. Update and install base prerequisites
echo "[+] Installing core prerequisites..."
apt-get update
apt-get install -y software-properties-common curl wget gpg apt-transport-https ca-certificates gnupg

# 2. Add Optimized Repositories
echo "[+] Configuring PPA repositories for cutting-edge gaming drivers..."
# Latest Mesa drivers for AMD/Intel graphics
add-apt-repository -y ppa:kisak/kisak-mesa

# Lutris PPA
add-apt-repository -y ppa:lutris-team/lutris

# WineHQ Repository Setup
echo "[+] Adding WineHQ repository..."
mkdir -pm755 /etc/apt/keyrings
wget -O - https://dl.winehq.org/wine-builds/winehq.key | gpg --dearmor -o /etc/apt/keyrings/winehq-archive-keyring.gpg
wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/$(lsb_release -cs)/winehq-$(lsb_release -cs).sources

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

# 4. Install Sway, Waybar, Wofi, Display Manager & System Trays
echo "[+] Installing Sway Window Manager & Wayland helpers..."
apt-get install -y --no-install-recommends \
    sway \
    xwayland \
    waybar \
    wofi \
    swaylock \
    swayidle \
    mako-notifier \
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
    python3-pip \
    python3-pyqt5 \
    python3-pyqt5.qtwebengine \
    sqlite3 \
    aria2 \
    calamares

# 5. Install Productivity & Daily Tools
echo "[+] Installing productivity software and daily-use tools..."
apt-get install -y \
    brave-browser \
    code \
    libreoffice-calc \
    libreoffice-writer \
    btop \
    fastfetch \
    git \
    ufw \
    gparted \
    flatpak

# 6. Install Gaming Stack & Performance Optimizations
echo "[+] Installing gaming prerequisites (Steam, Wine, Lutris, GameMode)..."
# Enable 32-bit architecture for Wine/Steam
dpkg --add-architecture i386
apt-get update

# Install Wine Stable, GameMode, and Lutris
apt-get install -y --install-recommends \
    winehq-stable \
    winetricks \
    gamemode \
    libgamemode0:i386 \
    lutris \
    steam

# 7. Apply System & Kernel Optimizations
echo "[+] Deploying kernel tuning parameters..."
# Copy custom sysctl configuration
if [ -f "./configs/99-aero-performance.conf" ]; then
    cp ./configs/99-aero-performance.conf /etc/sysctl.d/
    sysctl --system
else
    echo "[!] Warning: configs/99-aero-performance.conf not found. Skipping sysctl copy."
fi

# Copy custom gamemode configuration
if [ -f "./configs/gamemode.ini" ]; then
    mkdir -p /etc/xdg/
    cp ./configs/gamemode.ini /etc/xdg/gamemode.ini
else
    echo "[!] Warning: configs/gamemode.ini not found. Skipping GameMode config copy."
fi

# Enable ZRAM for compressed RAM space (massively improves memory footprint)
echo "[+] Enabling zRAM..."
apt-get install -y zram-config

# 8. Visual Customization & Default Skeleton Presets
echo "[+] Setting up user configuration templates (Sway, Waybar, Wofi)..."
# Set up configs under /etc/skel so that all newly created users get these configurations automatically
mkdir -p /etc/skel/.config/sway
mkdir -p /etc/skel/.config/waybar
mkdir -p /etc/skel/.config/wofi

[ -f "./configs/sway/config" ] && cp "./configs/sway/config" /etc/skel/.config/sway/config
[ -f "./configs/waybar/config" ] && cp "./configs/waybar/config" /etc/skel/.config/waybar/config

# Install Chicago95 GTK/Icon Retro theme dependencies for Nostalgia9x
echo "[+] Downloading Chicago95 Retro Icons and Themes..."
mkdir -p /usr/share/themes /usr/share/icons
wget -qO- https://github.com/grassmunk/Chicago95/archive/master.tar.gz | tar -xz -C /tmp/ || true
if [ -d "/tmp/Chicago95-master" ]; then
    cp -r /tmp/Chicago95-master/Theme/Chicago95 /usr/share/themes/ || true
    cp -r /tmp/Chicago95-master/Icons/Chicago95 /usr/share/icons/ || true
    rm -rf /tmp/Chicago95-master
fi

# Copy Theme assets
echo "[+] Copying visual theme presets..."
mkdir -p /usr/share/aeroos/themes
[ -d "./configs/themes" ] && cp -r ./configs/themes/* /usr/share/aeroos/themes/

# Set up default symlinks for a fresh skeleton user (using Nordic as default)
ln -sf /usr/share/aeroos/themes/nordic/sway.theme /etc/skel/.config/sway/theme
ln -sf /usr/share/aeroos/themes/nordic/waybar.css /etc/skel/.config/waybar/style.css
ln -sf /usr/share/aeroos/themes/nordic/wofi.css /etc/skel/.config/wofi/style.css

# Install the aero-theme selector utility
echo "[+] Deploying theme switcher utility..."
if [ -f "./aero-theme" ]; then
    cp "./aero-theme" /usr/local/bin/aero-theme
    chmod +x /usr/local/bin/aero-theme
fi

# Install Bauh App Store via pip3
echo "[+] Installing Bauh Universal App Store..."
pip3 install bauh --break-system-packages

if [ -f "./bauh.desktop" ]; then
    cp "./bauh.desktop" /usr/share/applications/bauh.desktop
fi

if [ -f "./install-aeroos.desktop" ]; then
    # Add to desktop of live environment
    mkdir -p /etc/skel/Desktop
    cp "./install-aeroos.desktop" /etc/skel/Desktop/install-aeroos.desktop
    chmod +x /etc/skel/Desktop/install-aeroos.desktop
    
    # Also register as system launcher
    cp "./install-aeroos.desktop" /usr/share/applications/install-aeroos.desktop
fi

# 9. Set Up Wayland Global Environment Variables for optimal gaming and scaling
echo "[+] Configuring global environment variables for Wayland..."
cat << 'EOF' >> /etc/environment
# Wayland Environment Optimizations for AeroOS
SDL_VIDEODRIVER=wayland,x11
QT_QPA_PLATFORM="wayland;xcb"
_JAVA_AWT_GTK_LOOKANDFEEL=1
MOZ_ENABLE_WAYLAND=1
EOF

# Enable UFW Firewall
echo "[+] Hardening system security with UFW..."
ufw limit ssh || true
ufw enable

echo "[+] ==========================================================="
echo "[+] AeroOS (Sway Wayland) Installation Completed Successfully!"
echo "[+] Please reboot the system to start your new optimized distro."
echo "[+] ==========================================================="
