export const settingsApp = {
  id: 'settings',
  name: 'Settings',
  category: 'System',
  icon: '⚙️',
  permissions: ['system.theme'],
  defaultSize: { width: 620, height: 420 },
  launch(ctx) {
    const { mount, services } = ctx;
    mount.innerHTML = `
      <div class="settings-app">
        <h3>Appearance</h3>
        <label>Theme
          <select id="theme-select">
            <option value="aero">Aero Blue</option>
            <option value="sunset">Sunset Glass</option>
          </select>
        </label>
        <label>Wallpaper URL
          <input id="wallpaper-url" placeholder="https://images..." />
        </label>
        <button id="apply-wallpaper">Apply Wallpaper</button>

        <h3>System</h3>
        <pre id="sysinfo"></pre>
      </div>
    `;

    mount.querySelector('#sysinfo').textContent = JSON.stringify(
      {
        userAgent: navigator.userAgent,
        language: navigator.language,
        time: new Date().toISOString(),
      },
      null,
      2,
    );

    mount.querySelector('#theme-select').addEventListener('change', (e) => services.theme.setTheme(e.target.value));
    mount.querySelector('#apply-wallpaper').addEventListener('click', () => {
      const url = mount.querySelector('#wallpaper-url').value.trim();
      if (!url) return;
      localStorage.setItem('aeroos-wallpaper', url);
      services.events.emit('wallpaper:changed', { url });
    });
  },
};
