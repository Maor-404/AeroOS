const LOCAL_KEY = 'aeroos-user-profile';
const SUPABASE_URL_KEY = 'aeroos-supabase-url';
const SUPABASE_ANON_KEY = 'aeroos-supabase-anon-key';

export class UserProfileService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.profile = null;
  }

  configure({ url, anonKey }) {
    if (url) localStorage.setItem(SUPABASE_URL_KEY, url);
    if (anonKey) localStorage.setItem(SUPABASE_ANON_KEY, anonKey);
  }

  getSupabaseConfig() {
    return {
      url: localStorage.getItem(SUPABASE_URL_KEY) || window.AEROOS_SUPABASE_URL,
      anonKey: localStorage.getItem(SUPABASE_ANON_KEY) || window.AEROOS_SUPABASE_ANON_KEY,
    };
  }

  async init() {
    const local = localStorage.getItem(LOCAL_KEY);
    if (local) {
      this.profile = JSON.parse(local);
      this.eventBus.emit('user:loaded', this.profile);
      return this.profile;
    }

    const remote = await this.loadFromSupabase();
    if (remote) {
      this.profile = remote;
      this.persistLocal(remote);
      this.eventBus.emit('user:loaded', this.profile);
      return this.profile;
    }

    return null;
  }

  persistLocal(profile) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
  }

  async save(profile) {
    this.profile = {
      id: profile.id || `user-${Date.now()}`,
      displayName: profile.displayName || 'Aero User',
      email: profile.email || '',
      theme: profile.theme || 'aero',
      avatar: profile.avatar || './assets/icons/avatar-aero.svg',
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.persistLocal(this.profile);
    await this.saveToSupabase(this.profile);
    this.eventBus.emit('user:updated', this.profile);
    return this.profile;
  }

  getProfile() {
    return this.profile;
  }

  async loadFromSupabase() {
    const { url, anonKey } = this.getSupabaseConfig();
    if (!url || !anonKey) return null;

    try {
      const response = await fetch(`${url}/rest/v1/aero_users?select=*&order=updatedAt.desc&limit=1`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      if (!response.ok) return null;
      const rows = await response.json();
      return rows?.[0] || null;
    } catch {
      return null;
    }
  }

  async saveToSupabase(profile) {
    const { url, anonKey } = this.getSupabaseConfig();
    if (!url || !anonKey) return;

    try {
      await fetch(`${url}/rest/v1/aero_users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(profile),
      });
    } catch {
      // noop fallback to local persistence
    }
  }
}
