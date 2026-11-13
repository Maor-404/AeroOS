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

  const INSTALL_TARGETS = {
    x64: {
      arch: "x86_64 (64-bit)",
      base: "Ubuntu 26.04 LTS",
      output: "Live ISO + Bare-Metal",
      code: `# Bare-metal Ubuntu 26.04 LTS (x86_64) setup
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power
sudo ./aero-setup.sh

# Or build a bootable x86_64 Live ISO:
sudo apt install -y squashfs-tools xorriso wget rsync curl
sudo ./build-iso.sh`,
    },
    x86: {
      arch: "i386 / i686 (32-bit)",
      base: "Debian/Ubuntu Minimal",
      output: "Legacy Sway + Rust Core",
      code: `# Legacy 32-bit x86 setup (compiled with Rust + C++17)
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power
sudo ./aero-setup.sh
# Compiles native i686 aero-hub & aero-webapp via rustc -O`,
    },
    arm64: {
      arch: "aarch64 (ARM64)",
      base: "Ubuntu 26.04 LTS ARM64",
      output: "Pi 5 / Apple Silicon VM",
      code: `# Ubuntu 26.04 LTS ARM64 (Raspberry Pi 5, UTM, QEMU, Cloud)
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
chmod +x aero-setup.sh aero-theme aero-power
sudo ./aero-setup.sh
# Builds native aarch64 aero-hub, aero-webapp & aero-browser`,
    },
    docker: {
      arch: "linux/amd64, linux/arm64",
      base: "ubuntu:26.04 OCI",
      output: "Containerized Control Hub",
      code: `# Build & run the AeroOS Control Hub container
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
docker build -t aeroos:26.04 .
docker run --rm -p 8080:8080 aeroos:26.04
# Open http://localhost:8080 in your browser`,
    },
    wsl: {
      arch: "x86_64 (Windows Host)",
      base: "WSL1 / WSL2 + Ubuntu 26.04",
      output: "aeroos-custom-26.04.iso",
      code: `# Build a bootable AeroOS 26.04 LTS ISO inside WSL1 / WSL2
git clone https://github.com/Maor-404/AeroOS.git
cd AeroOS
sudo apt install -y p7zip-full squashfs-tools xorriso wget rsync curl
sudo ./build-iso-wsl1.sh`,
    },
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
      const target = INSTALL_TARGETS[btn.dataset.install] || INSTALL_TARGETS.x64;
      $("#ver-arch").textContent = target.arch;
      $("#ver-base").textContent = target.base;
      $("#ver-output").textContent = target.output;
      $("#install-code-view").textContent = target.code;
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

  // Live Desktop Customizer Studio
  const CUST_KEY = "aeroos-customizer-v1";
  const DEFAULT_CUST = {
    accent: "#38bdf8",
    blur: 14,
    opacity: 62,
    radius: 18,
    waybar: "top",
    wallpaper: "",
  };
  let custState = { ...DEFAULT_CUST };
  try {
    const saved = JSON.parse(localStorage.getItem(CUST_KEY) || "null");
    if (saved && typeof saved === "object") custState = { ...DEFAULT_CUST, ...saved };
  } catch { /* ignore */ }

  function renderCustomizer() {
    const root = document.documentElement.style;
    root.setProperty("--accent", custState.accent);
    root.setProperty("--glass-blur", `${custState.blur}px`);
    root.setProperty("--radius", `${custState.radius}px`);
    root.setProperty("--surface", `rgba(9, 23, 38, ${(custState.opacity / 100).toFixed(2)})`);
    if (custState.wallpaper) {
      root.setProperty("--wallpaper", `url("${custState.wallpaper}")`);
    } else {
      root.removeProperty("--wallpaper");
    }

    const screen = $("#desktop-screen");
    if (screen) screen.classList.toggle("waybar-bottom", custState.waybar === "bottom");

    $("#cust-accent-val").textContent = custState.accent;
    $("#cust-accent-picker").value = custState.accent;
    $("#cust-blur").value = custState.blur;
    $("#cust-blur-val").textContent = `${custState.blur}px`;
    $("#cust-opacity").value = custState.opacity;
    $("#cust-opacity-val").textContent = `${custState.opacity}%`;
    $("#cust-radius").value = custState.radius;
    $("#cust-radius-val").textContent = `${custState.radius}px`;
    $("#cust-waybar-val").textContent = custState.waybar === "bottom" ? "Bottom" : "Top";
    $("#cust-wb-top").classList.toggle("active", custState.waybar === "top");
    $("#cust-wb-bottom").classList.toggle("active", custState.waybar === "bottom");

    document.querySelectorAll("#cust-swatches .swatch-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.color.toLowerCase() === custState.accent.toLowerCase());
    });

    const themeJson = {
      id: "custom-studio",
      name: "Aero Custom Studio",
      tagline: "Crafted live in the AeroOS Web Customizer",
      mode: custState.blur > 0 ? "glass" : "solid",
      accent: custState.accent,
      glassBlurPx: Number(custState.blur),
      panelOpacity: Number((custState.opacity / 100).toFixed(2)),
      cornerRadiusPx: Number(custState.radius),
      waybarPosition: custState.waybar,
    };
    $("#cust-json-preview").textContent = JSON.stringify(themeJson, null, 2);
    try {
      localStorage.setItem(CUST_KEY, JSON.stringify(custState));
    } catch { /* ignore quota */ }
  }

  document.querySelectorAll("#cust-swatches .swatch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      custState.accent = btn.dataset.color;
      renderCustomizer();
    });
  });

  $("#cust-accent-picker").addEventListener("input", (e) => {
    custState.accent = e.target.value;
    renderCustomizer();
  });

  $("#cust-blur").addEventListener("input", (e) => {
    custState.blur = Number(e.target.value);
    renderCustomizer();
  });

  $("#cust-opacity").addEventListener("input", (e) => {
    custState.opacity = Number(e.target.value);
    renderCustomizer();
  });

  $("#cust-radius").addEventListener("input", (e) => {
    custState.radius = Number(e.target.value);
    renderCustomizer();
  });

  ["#cust-wb-top", "#cust-wb-bottom"].forEach((sel) => {
    $(sel).addEventListener("click", (e) => {
      custState.waybar = e.currentTarget.dataset.waybar;
      renderCustomizer();
    });
  });

  $("#cust-wallpaper-upload").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      custState.wallpaper = String(reader.result || "");
      renderCustomizer();
    };
    reader.readAsDataURL(file);
  });

  $("#cust-reset-btn").addEventListener("click", () => {
    custState = { ...DEFAULT_CUST };
    localStorage.removeItem(CUST_KEY);
    renderCustomizer();
  });

  $("#cust-download-json").addEventListener("click", () => {
    const blob = new Blob([$("#cust-json-preview").textContent], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "theme.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#cust-copy-json").addEventListener("click", async () => {
    const btn = $("#cust-copy-json");
    try {
      await navigator.clipboard.writeText($("#cust-json-preview").textContent);
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy JSON"; }, 1500);
    } catch {
      btn.textContent = "Select & Copy";
    }
  });

  renderCustomizer();

  // Interactive Kitty Terminal in Desktop Stage
  const termForm = $("#mock-terminal-form");
  const termInput = $("#mock-terminal-input");
  const termOut = $("#mock-terminal-output code");
  if (termForm && termInput && termOut) {
    termForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = termInput.value.trim();
      if (!raw) return;
      termInput.value = "";
      if (raw === "clear") {
        termOut.textContent = "";
        return;
      }
      let reply = "";
      if (raw === "help") {
        reply = "Commands: help, fastfetch, uname -a, aero-theme <aero|nordic|sonokai|nostalgia9x>, aero-webapp list, clear";
      } else if (raw === "fastfetch") {
        reply = `OS: AeroOS 26.04 LTS (Sway Wayland)\nKernel: Linux 6.14 · UFW Active · zRAM\nStack: Rust (aero-hub, aero-webapp) + C++17 (aero-browser)\nAccent: ${custState.accent} · Blur: ${custState.blur}px`;
      } else if (raw === "uname -a") {
        reply = "Linux aeroos 6.14.0-generic #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux";
      } else if (raw === "aero-webapp list") {
        reply = "Installed: GitHub, Excalidraw, DuckDuckGo (via Rust aero-webapp)";
      } else if (raw.startsWith("aero-theme ")) {
        const t = raw.split(/\s+/)[1];
        if (THEME_LABELS[t]) {
          setPreviewTheme(t);
          reply = `[+] Switched theme to ${THEME_LABELS[t].title}`;
        } else {
          reply = `[-] Unknown theme '${t}'. Try: aero, nordic, sonokai, nostalgia9x`;
        }
      } else {
        reply = `zsh: command simulated — type "help" for built-in AeroOS commands`;
      }
      termOut.textContent += `\nmaor@aeroos:~$ ${raw}\n${reply}`;
      const pre = $("#mock-terminal-output");
      pre.scrollTop = pre.scrollHeight;
    });
  }
})();
