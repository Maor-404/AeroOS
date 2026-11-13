(() => {
  const THEME_LABELS = {
    aero: { label: "◐ aero", title: "Aero Glass" },
    nordic: { label: "◐ nordic", title: "Nordic Frost" },
    sonokai: { label: "◐ sonokai", title: "Sonokai Obsidian" },
    nostalgia9x: { label: "◐ nostalgia9x", title: "Nostalgia 9x" },
  };

  const STACK_SNIPPETS = {
    browser: {
      title: "aero-browser",
      href: "hub/index.html",
      linkText: "Open Hub →",
      code: `# Launch Aero Browser directly or with Super+Shift+B
aero-browser https://github.com

# Features built into aero-browser:
* Tabbed QtWebEngine browsing (Ctrl+T, Ctrl+W, Ctrl+L)
* Persistent local cache & sandboxed plugin defaults
* HTTPS / HTTP / LOCAL scheme status indicator
* Registered as an XDG WebBrowser desktop application`,
    },
    hub: {
      title: "aero-hub",
      href: "hub/index.html",
      linkText: "Try Live Hub →",
      code: `# Launch AeroOS Control Hub (Super+A)
aero-hub --tab overview

# Built-in local capabilities:
* Loopback HTTP + REST API bound strictly to 127.0.0.1
* Live /proc CPU, RAM, zRAM, disk & GameMode telemetry
* Instant 6-target theme switching & Ctrl+K command palette
* Same-origin POST/DELETE protection`,
    },
    webapp: {
      title: "aero-webapp",
      href: "hub/index.html?tab=webapps",
      linkText: "Manage WebApps →",
      code: `# Install any website as a borderless Wayland desktop app
aero-webapp install --name "Excalidraw" --url https://excalidraw.com

# Launch via Wofi menu (Super+W) or CLI:
aero-webapp menu
aero-webapp launch excalidraw`,
    },
  };

  const INSTALL_SNIPPETS = {
    setup: `git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power
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

  document.querySelectorAll("[data-stage-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.stageMode;
      document.querySelectorAll("[data-stage-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      $("#stage-browser-view").hidden = mode !== "browser";
      $("#stage-terminal-view").hidden = mode !== "terminal";
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

  document.querySelectorAll("[data-stack]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-stack]").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      const item = STACK_SNIPPETS[btn.dataset.stack];
      if (item) {
        $("#stack-visual-title").textContent = item.title;
        $("#stack-visual-link").href = item.href;
        $("#stack-visual-link").textContent = item.linkText;
        $("#stack-visual-code").textContent = item.code;
      }
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
