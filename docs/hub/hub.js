(() => {
  const FALLBACK_THEMES = [
    {
      id: "aero",
      name: "Aero Glass",
      tagline: "Translucent ocean-slate glass with crisp specular highlights",
      wallpaper: "aero-glass.jpg",
      swatches: ["#071422", "#0f273d", "#38bdf8", "#34d399", "#e0f2fe"],
      previewBg: "linear-gradient(135deg, #071422, #0d2b44)",
      barBg: "rgba(8, 21, 35, 0.78)",
      winBg: "rgba(11, 27, 44, 0.84)",
      text: "#f0f9ff",
      accent: "#38bdf8",
    },
    {
      id: "nordic",
      name: "Nordic Frost",
      tagline: "Calm arctic minimalism with slate polar night and glacial cyan",
      wallpaper: "nordic-frost.jpg",
      swatches: ["#2e3440", "#3b4252", "#88c0d0", "#8fbcbb", "#eceff4"],
      previewBg: "linear-gradient(135deg, #1e242e, #2e3440)",
      barBg: "rgba(46, 52, 64, 0.88)",
      winBg: "rgba(59, 66, 82, 0.9)",
      text: "#eceff4",
      accent: "#88c0d0",
    },
    {
      id: "sonokai",
      name: "Sonokai Obsidian",
      tagline: "Refined matte charcoal workspace with sage-emerald & ice-cyan accents",
      wallpaper: "sonokai-obsidian.jpg",
      swatches: ["#1f2127", "#2c2e34", "#7ec7a2", "#76cce0", "#e2e2e3"],
      previewBg: "linear-gradient(135deg, #1a1b20, #2c2e34)",
      barBg: "rgba(31, 33, 39, 0.9)",
      winBg: "rgba(44, 47, 55, 0.92)",
      text: "#ededee",
      accent: "#7ec7a2",
    },
    {
      id: "nostalgia9x",
      name: "Nostalgia 9x",
      tagline: "Classic Windows 95 beveled silver UI & iconic #008080 teal desktop",
      wallpaper: "solid:#008080",
      swatches: ["#008080", "#c0c0c0", "#dfdfdf", "#000080", "#000000"],
      previewBg: "#008080",
      barBg: "#c0c0c0",
      winBg: "#c0c0c0",
      text: "#000000",
      accent: "#000080",
    },
  ];

  const FALLBACK_CATALOG = [
    { slug: "github", name: "GitHub", url: "https://github.com", category: "Development", description: "Repositories, pull requests, issues, and Actions", color: "#38bdf8" },
    { slug: "excalidraw", name: "Excalidraw", url: "https://excalidraw.com", category: "Graphics", description: "Collaborative whiteboard and architecture diagrams", color: "#2dd4bf" },
    { slug: "photopea", name: "Photopea", url: "https://www.photopea.com", category: "Graphics", description: "Full-featured PSD, XCF, and raster/vector editor", color: "#38bdf8" },
    { slug: "mdn-docs", name: "MDN Web Docs", url: "https://developer.mozilla.org", category: "Development", description: "Web platform reference for HTML, CSS, and JavaScript", color: "#34d399" },
    { slug: "openstreetmap", name: "OpenStreetMap", url: "https://www.openstreetmap.org", category: "Network", description: "Open geographic maps and route planning", color: "#34d399" },
    { slug: "wikipedia", name: "Wikipedia", url: "https://www.wikipedia.org", category: "Office", description: "Free multilingual encyclopedia as a fast desktop app", color: "#94a3b8" },
  ];

  const SHORTCUTS = [
    { keys: "Super + Return", label: "Launch Kitty Terminal" },
    { keys: "Super + Space", label: "Open Wofi App Launcher" },
    { keys: "Super + A", label: "Open AeroOS Control Hub" },
    { keys: "Super + Shift + B", label: "Launch Aero Browser" },
    { keys: "Super + W", label: "Open WebApp Launcher Menu" },
    { keys: "Super + Shift + T", label: "Switch Desktop Theme" },
    { keys: "Super + Shift + P", label: "Session & Power Menu" },
    { keys: "Super + Ctrl + L", label: "Lock Screen (Swaylock)" },
    { keys: "Super + S", label: "Launch Bauh App Store" },
    { keys: "Super + E", label: "Open Thunar File Manager" },
    { keys: "Super + Q", label: "Close Focused Window" },
    { keys: "Super + F", label: "Toggle Fullscreen" },
    { keys: "Super + Shift + Space", label: "Toggle Floating Window" },
    { keys: "Print", label: "Region Screenshot to Clipboard" },
    { keys: "Super + Shift + Print", label: "Save Full Screenshot to Pictures" },
  ];

  const STORAGE_KEY_APPS = "aeroos_hub_preview_webapps";
  const STORAGE_KEY_THEME = "aeroos_hub_preview_theme";

  let liveMode = false;
  let currentTheme = "aero";
  let themesData = FALLBACK_THEMES;
  let installedApps = [];
  let catalogApps = FALLBACK_CATALOG;

  const $ = (sel) => document.querySelector(sel);

  function showToast(msg) {
    const region = $("#toast-region");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function withTransition(fn) {
    if (document.startViewTransition) {
      document.startViewTransition(fn);
    } else {
      fn();
    }
  }

  function slugify(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "webapp";
  }

  function setHtmlTheme(themeId) {
    currentTheme = themeId;
    document.documentElement.setAttribute("data-theme", themeId);
    const meta = themesData.find((t) => t.id === themeId);
    $("#header-active-theme").textContent = meta ? meta.name : themeId;
    if (!liveMode) {
      localStorage.setItem(STORAGE_KEY_THEME, themeId);
    }
    renderThemes();
  }

  async function apiGet(path) {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function apiSend(path, method, payload) {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function detectBackend() {
    try {
      const health = await apiGet("/api/health");
      liveMode = Boolean(health && health.ok && health.mode === "live");
    } catch {
      liveMode = false;
    }
    $("#hub-mode-value").textContent = liveMode ? "Live AeroOS System" : "Interactive Web Preview";
  }

  async function loadSystem() {
    if (!liveMode) {
      renderSystemSnapshot({
        hostname: "aeroos-preview",
        os: "AeroOS 24.04 LTS (Sway Wayland)",
        kernel: "6.8.0-generic",
        arch: "x86_64",
        uptime: "Preview",
        compositor: "Sway / Wayland (Simulated)",
        cpuPercent: 14.2,
        cpuCores: navigator.hardwareConcurrency || 8,
        memory: { usedGb: 2.1, totalGb: 16.0, percent: 13.1, zramActive: true },
        disk: { usedGb: 18.4, totalGb: 120.0, percent: 15.3 },
        gamemode: { installed: true, active: false },
        sysctl: { swappiness: "10", maxMapCount: "2147483642", congestion: "bbr", qdisc: "fq" },
      });
      return;
    }
    try {
      const snap = await apiGet("/api/system");
      renderSystemSnapshot(snap);
    } catch {
      showToast("Could not refresh system telemetry.");
    }
  }

  function renderSystemSnapshot(s) {
    $("#stat-cpu").textContent = `${s.cpuPercent}%`;
    $("#bar-cpu").style.width = `${Math.min(100, s.cpuPercent)}%`;
    $("#stat-cores").textContent = `${s.cpuCores} logical cores`;

    $("#stat-ram").textContent = `${s.memory.percent}%`;
    $("#bar-ram").style.width = `${Math.min(100, s.memory.percent)}%`;
    $("#stat-ram-detail").textContent = `${s.memory.usedGb} / ${s.memory.totalGb} GB`;

    $("#stat-disk").textContent = `${s.disk.percent}%`;
    $("#bar-disk").style.width = `${Math.min(100, s.disk.percent)}%`;
    $("#stat-disk-detail").textContent = `${s.disk.usedGb} / ${s.disk.totalGb} GB`;

    $("#stat-gamemode").textContent = s.gamemode.active ? "Active" : (s.gamemode.installed ? "Ready" : "Not Installed");
    $("#stat-kernel").textContent = `${s.kernel} · ${s.compositor}`;
    $("#stat-uptime").textContent = `Uptime: ${s.uptime}`;

    $("#env-os").textContent = s.os;
    $("#env-host").textContent = s.hostname;
    $("#env-compositor").textContent = s.compositor;
    $("#env-arch").textContent = s.arch;
    $("#env-kernel").textContent = s.kernel;
    $("#env-zram").textContent = s.memory.zramActive ? "Active (Compressed RAM)" : "Configured in aero-setup";

    if (s.sysctl) {
      $("#sys-swappiness").textContent = s.sysctl.swappiness;
      $("#sys-maxmap").textContent = s.sysctl.maxMapCount;
      $("#sys-bbr").textContent = s.sysctl.congestion;
      $("#sys-qdisc").textContent = s.sysctl.qdisc;
    }
  }

  async function loadThemes() {
    if (liveMode) {
      try {
        const res = await apiGet("/api/themes");
        if (Array.isArray(res.themes) && res.themes.length) {
          themesData = FALLBACK_THEMES.map((base) => {
            const found = res.themes.find((t) => t.id === base.id);
            return found ? { ...base, ...found } : base;
          });
          setHtmlTheme(res.current || "aero");
          return;
        }
      } catch {
        /* fallback */
      }
    }
    const saved = localStorage.getItem(STORAGE_KEY_THEME) || "aero";
    setHtmlTheme(saved);
  }

  async function applyTheme(themeId) {
    withTransition(() => setHtmlTheme(themeId));
    if (liveMode) {
      try {
        await apiSend("/api/theme", "POST", { theme: themeId });
        showToast(`Applied '${themeId}' across Sway, Waybar, Wofi, Mako, Swaylock & Kitty.`);
      } catch (err) {
        showToast(`Theme preview updated (OS apply error: ${err.message})`);
      }
    } else {
      showToast(`Preview switched to '${themeId}'.`);
    }
  }

  function renderThemes() {
    const grid = $("#themes-grid");
    grid.innerHTML = "";
    themesData.forEach((t) => {
      const card = document.createElement("article");
      card.className = `theme-card${t.id === currentTheme ? " active" : ""}`;
      const wallUrl = t.wallpaper && !t.wallpaper.startsWith("solid:")
        ? `../assets/wallpapers/${t.wallpaper}`
        : "";
      const previewStyle = wallUrl
        ? `background-image: url('${wallUrl}')`
        : `background: ${t.previewBg}`;

      const swatchesHtml = (t.swatches || [])
        .map((c) => `<span class="swatch-dot" style="background:${c}" title="${c}"></span>`)
        .join("");

      card.innerHTML = `
        <div class="theme-preview" style="${previewStyle}">
          <div class="theme-mini-bar" style="background:${t.barBg}; color:${t.text};">
            <span>◈ Aero</span>
            <span>1 · 2 · 3</span>
          </div>
          <div class="theme-mini-window" style="background:${t.winBg}; color:${t.text}; border:1px solid ${t.accent};">
            <strong>${t.name}</strong><br>
            <span style="opacity:0.8">Wayland · Sway</span>
          </div>
        </div>
        <div class="theme-meta">
          <div>
            <h3>${t.name}</h3>
            <p>${t.tagline}</p>
          </div>
          <div class="swatch-row">${swatchesHtml}</div>
        </div>
        <div class="theme-footer">
          <span class="theme-targets">Sway · Waybar · Wofi · Mako · Kitty</span>
          <button type="button" class="btn ${t.id === currentTheme ? "btn-secondary" : "btn-primary"}" data-apply-theme="${t.id}">
            ${t.id === currentTheme ? "Active Theme" : "Apply Theme"}
          </button>
        </div>
      `;
      card.querySelector("[data-apply-theme]").addEventListener("click", () => applyTheme(t.id));
      grid.appendChild(card);
    });
  }

  async function loadWebApps() {
    if (liveMode) {
      try {
        const res = await apiGet("/api/webapps");
        installedApps = res.installed || [];
        catalogApps = (res.catalog && res.catalog.length) ? res.catalog : FALLBACK_CATALOG;
      } catch {
        installedApps = [];
      }
    } else {
      try {
        installedApps = JSON.parse(localStorage.getItem(STORAGE_KEY_APPS) || "[]");
      } catch {
        installedApps = [];
      }
    }
    renderWebApps();
  }

  function savePreviewApps() {
    localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(installedApps));
  }

  async function installWebApp(payload) {
    if (liveMode) {
      await apiSend("/api/webapps", "POST", payload);
      await loadWebApps();
      showToast(`Installed '${payload.name}' as a borderless desktop WebApp.`);
      return;
    }
    const slug = payload.slug || slugify(payload.name);
    const cleanUrl = /^https?:\/\//i.test(payload.url) ? payload.url : `https://${payload.url}`;
    installedApps = installedApps.filter((a) => a.slug !== slug);
    installedApps.push({ ...payload, slug, url: cleanUrl });
    savePreviewApps();
    renderWebApps();
    showToast(`Added '${payload.name}' to WebApps preview.`);
  }

  async function launchWebApp(app) {
    if (liveMode) {
      try {
        await apiSend("/api/webapps/launch", "POST", { slug: app.slug });
        showToast(`Launching ${app.name}...`);
      } catch (err) {
        showToast(`Launch failed: ${err.message}`);
      }
    } else {
      window.open(app.url, "_blank", "noopener,noreferrer");
    }
  }

  async function removeWebApp(slug, name) {
    if (liveMode) {
      await apiSend(`/api/webapps?slug=${encodeURIComponent(slug)}`, "DELETE");
      await loadWebApps();
    } else {
      installedApps = installedApps.filter((a) => a.slug !== slug);
      savePreviewApps();
      renderWebApps();
    }
    showToast(`Removed '${name}'.`);
  }

  function initialsFor(name) {
    return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "W";
  }

  function renderWebApps() {
    $("#installed-count").textContent = `${installedApps.length} installed`;
    const instGrid = $("#installed-webapps-list");
    instGrid.innerHTML = "";

    if (!installedApps.length) {
      instGrid.innerHTML = `<p class="webapp-desc">No WebApps installed yet. Install one from the curated catalog below or enter any URL above.</p>`;
    } else {
      installedApps.forEach((app) => {
        const el = document.createElement("article");
        el.className = "webapp-item";
        el.innerHTML = `
          <div class="webapp-top">
            <div class="webapp-badge">${initialsFor(app.name)}</div>
            <div class="webapp-info">
              <h3>${app.name}</h3>
              <div class="webapp-url">${app.url}</div>
            </div>
          </div>
          <div class="webapp-actions">
            <button type="button" class="btn btn-primary" data-launch="${app.slug}">Launch</button>
            <button type="button" class="btn btn-danger" data-remove="${app.slug}">Remove</button>
          </div>
        `;
        el.querySelector("[data-launch]").addEventListener("click", () => launchWebApp(app));
        el.querySelector("[data-remove]").addEventListener("click", () => removeWebApp(app.slug, app.name));
        instGrid.appendChild(el);
      });
    }

    const catGrid = $("#catalog-webapps-list");
    catGrid.innerHTML = "";
    const installedSlugs = new Set(installedApps.map((a) => a.slug));
    catalogApps.forEach((item) => {
      const isInstalled = installedSlugs.has(item.slug);
      const el = document.createElement("article");
      el.className = "webapp-item";
      el.innerHTML = `
        <div class="webapp-top">
          <div class="webapp-badge">${initialsFor(item.name)}</div>
          <div class="webapp-info">
            <h3>${item.name}</h3>
            <div class="webapp-url">${item.url}</div>
          </div>
        </div>
        <p class="webapp-desc">${item.description || ""}</p>
        <div class="webapp-actions">
          <button type="button" class="btn ${isInstalled ? "btn-secondary" : "btn-primary"}" data-cat-install="${item.slug}">
            ${isInstalled ? "Reinstall" : "Install WebApp"}
          </button>
        </div>
      `;
      el.querySelector("[data-cat-install]").addEventListener("click", async () => {
        try {
          await installWebApp({
            slug: item.slug,
            name: item.name,
            url: item.url,
            category: item.category || "Network",
            engine: "auto",
            color: item.color || "#38bdf8",
          });
        } catch (err) {
          showToast(err.message);
        }
      });
      catGrid.appendChild(el);
    });
  }

  function renderShortcuts(filter = "") {
    const list = $("#shortcuts-list");
    list.innerHTML = "";
    const q = filter.trim().toLowerCase();
    SHORTCUTS.filter((s) => !q || s.keys.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
      .forEach((s) => {
        const row = document.createElement("div");
        row.className = "shortcut-row";
        row.innerHTML = `<span>${s.label}</span><kbd>${s.keys}</kbd>`;
        list.appendChild(row);
      });
  }

  function switchTab(tabId, animate = true) {
    const valid = ["overview", "themes", "webapps", "performance"];
    const target = valid.includes(tabId) ? tabId : "overview";
    const apply = () => {
      document.querySelectorAll(".nav-item").forEach((btn) => {
        const active = btn.dataset.tab === target;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        const active = panel.id === `tab-${target}`;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    };
    if (animate) withTransition(apply);
    else apply();
  }

  function renderCommandResults(query = "") {
    const container = $("#command-results");
    container.innerHTML = "";
    const q = query.trim().toLowerCase();
    const items = [
      { label: "Go to Overview", kind: "Section", run: () => switchTab("overview") },
      { label: "Go to Themes & Look", kind: "Section", run: () => switchTab("themes") },
      { label: "Go to WebApps & PWAs", kind: "Section", run: () => switchTab("webapps") },
      { label: "Go to Tuning & Keys", kind: "Section", run: () => switchTab("performance") },
      ...themesData.map((t) => ({
        label: `Apply Theme: ${t.name}`,
        kind: "Theme",
        run: () => applyTheme(t.id),
      })),
      ...installedApps.map((a) => ({
        label: `Launch WebApp: ${a.name}`,
        kind: "WebApp",
        run: () => launchWebApp(a),
      })),
    ].filter((item) => !q || item.label.toLowerCase().includes(q) || item.kind.toLowerCase().includes(q));

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "command-option";
      btn.innerHTML = `<span>${item.label}</span><span class="command-kind">${item.kind}</span>`;
      btn.addEventListener("click", () => {
        $("#command-dialog").close();
        item.run();
      });
      container.appendChild(btn);
    });
  }

  function wireEvents() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    $("#refresh-telemetry-btn").addEventListener("click", () => {
      loadSystem();
      showToast("Telemetry refreshed.");
    });

    document.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        if (!liveMode) {
          showToast(`Action '${action}' triggers natively on an installed AeroOS Wayland session.`);
          return;
        }
        try {
          await apiSend("/api/action", "POST", { action });
          showToast(`Executed ${action}.`);
        } catch (err) {
          showToast(`Action unavailable: ${err.message}`);
        }
      });
    });

    $("#webapp-install-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#webapp-name-input").value.trim();
      const url = $("#webapp-url-input").value.trim();
      const category = $("#webapp-category-select").value;
      const engine = $("#webapp-engine-select").value;
      if (!name || !url) return;
      try {
        await installWebApp({ name, url, category, engine });
        e.target.reset();
      } catch (err) {
        showToast(err.message);
      }
    });

    $("#shortcut-filter").addEventListener("input", (e) => renderShortcuts(e.target.value));

    const dialog = $("#command-dialog");
    const cmdInput = $("#command-search-input");
    const openPalette = () => {
      cmdInput.value = "";
      renderCommandResults("");
      dialog.showModal();
      cmdInput.focus();
    };
    $("#hub-command-trigger").addEventListener("click", openPalette);
    cmdInput.addEventListener("input", (e) => renderCommandResults(e.target.value));
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.open) dialog.close();
        else openPalette();
      }
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab")) {
      switchTab(params.get("tab"), false);
    }
    wireEvents();
    renderShortcuts();
    renderThemes();
    renderWebApps();
    await detectBackend();
    await Promise.all([loadThemes(), loadSystem(), loadWebApps()]);
    if (params.get("theme") && themesData.some((t) => t.id === params.get("theme"))) {
      setHtmlTheme(params.get("theme"));
    }
  }

  init();
})();
