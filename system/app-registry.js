export class AppRegistry {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.apps = new Map();
  }

  register(config) {
    if (!config.id) throw new Error('App requires id');
    this.apps.set(config.id, config);
    this.eventBus.emit('app:registered', config);
  }

  unregister(id) {
    if (this.apps.has(id)) {
      const config = this.apps.get(id);
      this.apps.delete(id);
      this.eventBus.emit('app:unregistered', config);
    }
  }

  get(id) {
    return this.apps.get(id);
  }

  search(query = '') {
    const q = query.toLowerCase();
    return [...this.apps.values()].filter((app) => app.name.toLowerCase().includes(q));
  }

  list() {
    return [...this.apps.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
