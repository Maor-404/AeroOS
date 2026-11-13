# AeroOS (Sway Wayland Edition)

AeroOS transforms a minimal **Ubuntu 24.04 LTS** system into a fast, gaming-tuned **Sway Wayland** desktop featuring synchronized glassmorphism looks, a local WebEngine **Control Hub**, and a borderless **WebApp / PWA Manager**.

## What's New

- **4 Synchronized Desktop Themes (`aero-theme`)**:
  - **Aero Glass** *(Default)*: Translucent ocean-slate Waybar, Wofi, Mako notifications, Swaylock, Kitty palette, and custom glass wallpaper.
  - **Nordic Frost**: Calm Polar Night & glacial cyan minimalism with arctic aurora wallpaper.
  - **Sonokai Obsidian**: Matte charcoal workspace with sage-emerald & ice-cyan accents.
  - **Nostalgia 9x**: Classic Windows 95 beveled taskbar and `#008080` teal styling.
- **AeroOS Control Hub (`aero-hub`)**:
  - Local loopback HTTP + REST backend paired with a frameless PyQt5 QtWebEngine / Chromium window (`docs/hub/`).
  - Live `/proc` CPU, memory/zRAM, disk, and `gamemoded` telemetry, visual theme studio, kernel sysctl inspector, and keyboard shortcut search (`Ctrl+K`).
- **Borderless WebApps & PWAs (`aero-webapp`)**:
  - Install any URL as an isolated desktop application with generated SVG icons and `.desktop` entries indexed by Wofi (`Super+W`).
- **GitHub Pages Showcase (`docs/`)**:
  - Interactive live desktop preview and browser-playable Control Hub ready to deploy via GitHub Pages from `/docs`.

## Key Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Super + Return` | Launch Kitty terminal |
| `Super + Space` | Open Wofi application launcher |
| `Super + A` | Open AeroOS Control Hub |
| `Super + W` | Open WebApps launcher menu |
| `Super + Shift + T` | Visual theme switcher |
| `Super + Shift + P` | Session & power menu |
| `Super + Ctrl + L` | Lock screen (`swaylock`) |
| `Super + S` | Launch Bauh App Center |
| `Print` | Region screenshot to clipboard |

## Quick Start

### Convert an Existing Ubuntu 24.04 System

```bash
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power aero-webapp aero-hub
sudo ./aero-setup.sh
```

### Build a Bootable Custom ISO

```bash
sudo apt install -y squashfs-tools xorriso wget rsync curl
sudo ./build-iso.sh
```

Or on WSL1:

```bash
sudo apt install -y p7zip-full squashfs-tools xorriso wget rsync curl
sudo ./build-iso-wsl1.sh
```

### Preview the Web Showcase & Control Hub Locally

```bash
./aero-hub --serve-only --port 8080
# Or serve the full showcase + hub:
python3 -m http.server 8080 --directory docs
```
