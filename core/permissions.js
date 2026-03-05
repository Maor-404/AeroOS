const DEFAULTS = {
  terminal: ['filesystem.read', 'filesystem.write', 'notifications'],
  filemanager: ['filesystem.read', 'filesystem.write', 'filesystem.delete', 'notifications'],
  texteditor: ['filesystem.read', 'filesystem.write', 'notifications'],
  settings: ['system.theme'],
  browser: ['network'],
  taskmanager: ['system.process.read', 'system.process.control'],
  systemmonitor: ['system.metrics.read'],
};

export class PermissionManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.policies = new Map(Object.entries(DEFAULTS));
    this.grants = new Map();
  }

  registerApp(appId, requested = []) {
    const baseline = this.policies.get(appId) || [];
    this.policies.set(appId, [...new Set([...baseline, ...requested])]);
  }

  async request(appId, permission) {
    const key = `${appId}:${permission}`;
    if (this.grants.get(key) === true) return true;

    const allowedList = this.policies.get(appId) || [];
    if (!allowedList.includes(permission)) return false;

    const allowed = window.confirm(`${appId} requests permission: ${permission}`);
    this.grants.set(key, allowed);
    this.eventBus.emit('permission:decision', { appId, permission, allowed });
    return allowed;
  }

  can(appId, permission) {
    return this.grants.get(`${appId}:${permission}`) === true;
  }
}
