(() => {
  const THEME_LABELS = {
    aero: { label: "◐ aero", title: "Aero Glass" },
    nordic: { label: "◐ nordic", title: "Nordic Frost" },
    sonokai: { label: "◐ sonokai", title: "Sonokai Obsidian" },
    nostalgia9x: { label: "◐ nostalgia9x", title: "Nostalgia 9x" },
  };

  const PERF_SNIPPETS = {
    kernel: `# /etc/sysctl.d/99-aero-performance.conf
vm.swappiness = 10
vm.max_map_count = 2147483642
vm.dirty_background_ratio = 5
vm.dirty_ratio = 10
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
fs.file-max = 2097152`,
    gaming: `# AeroOS Gaming & Wayland Graphics Stack (aero-setup.sh)
* ppa:kisak/kisak-mesa       -> Up-to-date Vulkan & Mesa drivers
* winehq-stable + winetricks -> Windows compatibility layer
* gamemode + gamemode.ini    -> Automatic CPU performance governor
* lutris + steam + zram      -> Game launchers + compressed RAM
* Wayland ENV hints          -> SDL/Qt/Firefox/Electron native Wayland`,
    themes: `# Synchronized via aero-theme across 6 desktop surfaces
~/.config/sway/theme       -> Wallpaper + window border palette
~/.config/waybar/style.css -> Floating glass bar & module pills
~/.config/wofi/style.css   -> Centered translucent app launcher
~/.config/mako/config      -> Desktop notification banners
~/.config/swaylock/config  -> Screen lock background & ring colors
~/.config/kitty/theme.conf -> Terminal palette & background opacity`,
  };

  const INSTALL_SNIPPETS = {
    setup: `git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power aero-webapp aero-hub
sudo ./aero-setup.sh`,
    iso: `git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
sudo apt install -y squashfs-tools xorriso wget rsync curl
sudo ./build-iso.sh`,
    wsl: `git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
sudo apt install -y p7zip-full squashfs-tools xorriso wget rsync curl
sudo ./build-iso-wsl1.sh`,
  };

  const $ = (sel) => document.querySelector(sel);

  function setPreviewTheme(themeId) {
    document.documentElement.setAttribute("data-preview-theme", themeId);
    document.querySelectorAll(".theme-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeId === themeId);
    });
    const info = THEME_LABELS[themeId] || THEME_LABELS.aero;
    $("#mock-theme-label").textContent = info.label;
    $("#mock-card-theme").textContent = info.title;
  }

  document.querySelectorAll(".theme-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.themeId;
      if (document.startViewTransition) {
        document.startViewTransition(() => setPreviewTheme(id));
      } else {
        setPreviewTheme(id);
      }
    });
  });

  document.querySelectorAll(".wb-ws").forEach((wsBtn) => {
    wsBtn.addEventListener("click", () => {
      document.querySelectorAll(".wb-ws").forEach((b) => b.classList.remove("active"));
      wsBtn.classList.add("active");
    });
  });

  const wofi = $("#mock-wofi");
  $("#mock-launcher-btn").addEventListener("click", () => {
    wofi.hidden = !wofi.hidden;
  });

  let makoTimer = null;
  $("#trigger-mock-notify").addEventListener("click", () => {
    const mako = $("#mock-mako");
    const theme = document.documentElement.getAttribute("data-preview-theme") || "aero";
    $("#mock-mako-text").textContent = `Active theme '${theme}' reloaded across Wayland.`;
    mako.hidden = false;
    clearTimeout(makoTimer);
    makoTimer = setTimeout(() => {
      mako.hidden = true;
    }, 3000);
  });

  document.querySelectorAll("[data-perf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-perf]").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      $("#perf-code-view").textContent = PERF_SNIPPETS[btn.dataset.perf] || "";
    });
  });

  document.querySelectorAll("[data-install]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-install]").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      $("#install-code-view").textContent = INSTALL_SNIPPETS[btn.dataset.install] || "";
    });
  });

  $("#copy-install-btn").addEventListener("click", async () => {
    const text = $("#install-code-view").textContent;
    const btn = $("#copy-install-btn");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1800);
    } catch {
      btn.textContent = "Select & Copy";
    }
  });
})();
