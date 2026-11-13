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

# 1. Update and install base prerequisites
echo "[+] Installing core prerequisites..."
apt-get update
apt-get install -y software-properties-common curl wget gpg apt-transport-https ca-certificates gnupg lsb-release

# 2. Add Optimized Repositories
echo "[+] Configuring PPA repositories for cutting-edge gaming drivers..."
# Latest Mesa drivers for AMD/Intel graphics
add-apt-repository -y ppa:kisak/kisak-mesa

# Lutris PPA
add-apt-repository -y ppa:lutris-team/lutris

# WineHQ Repository Setup
echo "[+] Adding WineHQ repository..."
mkdir -p /etc/apt/keyrings
chmod 755 /etc/apt/keyrings
wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key
wget -NP /etc/apt/sources.list.d/ "https://dl.winehq.org/wine-builds/ubuntu/dists/$(lsb_release -cs)/winehq-$(lsb_release -cs).sources"

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

# 4. Install Sway, Waybar, Wofi, Display Manager, Fonts & System Trays
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

echo "[+] Installing modern desktop fonts and icon themes..."
apt-get install -y --no-install-recommends \
    fonts-font-awesome \
    fonts-inter \
    fonts-jetbrains-mono \
    fonts-noto-color-emoji \
    papirus-icon-theme || true

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
if [ -f "./configs/99-aero-performance.conf" ]; then
    cp ./configs/99-aero-performance.conf /etc/sysctl.d/
    sysctl --system || true
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
apt-get install -y zram-config

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

# Install AeroOS CLI & Web Hub utilities
echo "[+] Deploying AeroOS utilities (aero-theme, aero-power, aero-webapp, aero-hub)..."
for tool in aero-theme aero-power aero-webapp aero-hub; do
    if [ -f "./${tool}" ]; then
        cp "./${tool}" "/usr/local/bin/${tool}"
        chmod +x "/usr/local/bin/${tool}"
    fi
done

# Install Bauh App Store via pip3
echo "[+] Installing Bauh Universal App Store..."
pip3 install bauh --break-system-packages

for desktop_file in bauh.desktop aero-hub.desktop aero-theme.desktop aero-webapp.desktop; do
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

# Enable UFW Firewall
echo "[+] Hardening system security with UFW..."
ufw limit ssh || true
ufw --force enable || true
systemctl enable ufw || true

echo "[+] ==========================================================="
echo "[+] AeroOS (Sway Wayland) Installation Completed Successfully!"
echo "[+] Please reboot the system to start your new optimized distro."
echo "[+] ==========================================================="
