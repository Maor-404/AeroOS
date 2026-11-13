# AeroOS (Sway Wayland Edition)

AeroOS transforms a minimal **Ubuntu 26.04 LTS** system into a fast, gaming-tuned **Sway Wayland** desktop featuring synchronized glassmorphism looks, a local WebEngine **Control Hub**, and a borderless **WebApp / PWA Manager**.

## What's New

- **4 Synchronized Desktop Themes (`aero-theme`)**:
  - **Aero Glass** *(Default)*: Translucent ocean-slate Waybar, Wofi, Mako notifications, Swaylock, Kitty palette, and custom glass wallpaper.
  - **Nordic Frost**: Calm Polar Night & glacial cyan minimalism with arctic aurora wallpaper.
  - **Sonokai Obsidian**: Matte charcoal workspace with sage-emerald & ice-cyan accents.
  - **Nostalgia 9x**: Classic Windows 95 beveled taskbar and `#008080` teal styling.
- **AeroOS Control Hub (`aero-hub`, Rust)**:
  - Zero-dependency Rust loopback HTTP + REST backend paired with a frameless `aero-browser --app` / Chromium window (`docs/hub/`).
  - Live `/proc` CPU, memory/zRAM, disk, and `gamemoded` telemetry, visual theme studio, kernel sysctl inspector, and keyboard shortcut search (`Ctrl+K`).
- **Aero Browser (`aero-browser`, C++17 + Qt5 WebEngine)**:
  - Lightweight tabbed Wayland browser with `--app <url>` frameless mode for isolated web apps and the Control Hub.
- **Borderless WebApps & PWAs (`aero-webapp`, Rust)**:
  - Zero-dependency Rust CLI that installs any URL as an isolated desktop application with generated SVG icons and `.desktop` entries indexed by Wofi (`Super+W`).
- **Minimal & Hardened Base (`Ubuntu 26.04 LTS`)**:
  - `--no-install-recommends` package selection, `ufw` default-deny firewall, `unattended-upgrades`, curated lean utilities (`mpv`, `imv`, `ncdu`, `ripgrep`, `fzf`, `mangohud`), and build-time compiler cleanup.
- **GitHub Pages Showcase (`docs/`)**:
  - Interactive live desktop preview and browser-playable Control Hub ready to deploy via GitHub Pages from `/docs`.

## Key Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Super + Return` | Launch Kitty terminal |
| `Super + Space` | Open Wofi application launcher |
| `Super + A` | Open AeroOS Control Hub |
| `Super + Shift + B` | Launch Aero Browser |
| `Super + W` | Open WebApps launcher menu |
| `Super + Shift + T` | Visual theme switcher |
| `Super + Shift + P` | Session & power menu |
| `Super + Ctrl + L` | Lock screen (`swaylock`) |
| `Super + S` | Launch Bauh App Center |
| `Print` | Region screenshot to clipboard |

## Quick Start

### Convert an Existing Ubuntu 26.04 LTS System

```bash
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power
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
make hub
./aero-hub --serve-only --port 8080
```
