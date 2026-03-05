export class UserSetup {
  constructor(eventBus, userProfiles, themeManager) {
    this.eventBus = eventBus;
    this.userProfiles = userProfiles;
    this.themeManager = themeManager;
    this.node = document.getElementById('user-setup');
  }

  async init() {
    const profile = await this.userProfiles.init();
    if (profile) {
      this.applyProfile(profile);
      return profile;
    }

    this.render();
    this.node.classList.remove('hidden');
    return null;
  }

  render() {
    this.node.innerHTML = `
      <div class="setup-card">
        <h2>Welcome to AeroOS</h2>
        <p>Complete quick profile setup. Optional: configure Supabase to sync profile.</p>
        <label>Display Name<input id="setup-name" placeholder="Aero User" /></label>
        <label>Email<input id="setup-email" placeholder="user@example.com" /></label>
        <label>Supabase URL (optional)<input id="setup-url" placeholder="https://xyz.supabase.co" /></label>
        <label>Supabase Anon Key (optional)<input id="setup-key" placeholder="ey..." /></label>
        <button id="setup-save">Start AeroOS</button>
      </div>
    `;

    this.node.querySelector('#setup-save').addEventListener('click', async () => {
      const displayName = this.node.querySelector('#setup-name').value.trim();
      const email = this.node.querySelector('#setup-email').value.trim();
      const url = this.node.querySelector('#setup-url').value.trim();
      const anonKey = this.node.querySelector('#setup-key').value.trim();

      this.userProfiles.configure({ url, anonKey });
      const profile = await this.userProfiles.save({ displayName, email, theme: document.documentElement.dataset.theme || 'aero' });
      this.applyProfile(profile);
      this.node.classList.add('hidden');
    });
  }

  applyProfile(profile) {
    if (profile.theme) this.themeManager.setTheme(profile.theme);
    this.eventBus.emit('user:ready', profile);
  }
}
