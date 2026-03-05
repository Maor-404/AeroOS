const DEFAULTS = {
  terminal: ['fs:read', 'fs:write'],
  filemanager: ['fs:read', 'fs:write', 'fs:delete'],
  texteditor: ['fs:read', 'fs:write'],
  settings: ['system:theme'],
  browser: ['network:basic'],
};

export class PermissionManager {
  constructor() {
    this.policies = new Map(Object.entries(DEFAULTS));
  }

  grant(appId, permission) {
    if (!this.policies.has(appId)) this.policies.set(appId, []);
    const list = this.policies.get(appId);
    if (!list.includes(permission)) list.push(permission);
  }

  can(appId, permission) {
    return (this.policies.get(appId) || []).includes(permission);
  }
}
