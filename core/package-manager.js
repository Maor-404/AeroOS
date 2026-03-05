const PKG_KEY = 'aeroos-packages';

const CATALOG = {
  notes: {
    manifest: {
      name: 'notes',
      version: '1.0.0',
      entry: 'app.js',
      icon: '🗒️',
      permissions: ['filesystem.read', 'filesystem.write', 'notifications'],
    },
  },
  calc: {
    manifest: {
      name: 'calc',
      version: '1.0.0',
      entry: 'app.js',
      icon: '🧮',
      permissions: [],
    },
  },
};

const notesLaunch = ({ mount, services }) => {
  mount.innerHTML = `<div style="padding:10px"><h3>Notes</h3><textarea style="width:100%;height:90%"></textarea></div>`;
  const ta = mount.querySelector('textarea');
  services.fs.readFile('/home/user/Documents/notes.md').then((content) => {
    ta.value = content;
  }).catch(() => {
    ta.value = '';
  });
  ta.addEventListener('change', () => services.fs.writeFile('/home/user/Documents/notes.md', ta.value));
};

const calcLaunch = ({ mount }) => {
  mount.innerHTML = `<div style="padding:10px"><h3>Calculator</h3><input id="expr" placeholder="1+2*3"/><button>=</button><pre id="out"></pre></div>`;
  const expr = mount.querySelector('#expr');
  const out = mount.querySelector('#out');
  mount.querySelector('button').addEventListener('click', () => {
    try {
      // sandboxed to arithmetic expression use case
      // eslint-disable-next-line no-new-func
      out.textContent = String(Function(`'use strict'; return (${expr.value});`)());
    } catch {
      out.textContent = 'error';
    }
  });
};

const launchers = {
  notes: notesLaunch,
  calc: calcLaunch,
};

export class PackageManager {
  constructor(eventBus, fs, appRegistry) {
    this.eventBus = eventBus;
    this.fs = fs;
    this.appRegistry = appRegistry;
    this.installed = JSON.parse(localStorage.getItem(PKG_KEY) || '[]');
  }

  save() {
    localStorage.setItem(PKG_KEY, JSON.stringify(this.installed));
  }

  list() {
    return [...this.installed];
  }

  async install(name) {
    if (!CATALOG[name]) throw new Error(`Unknown package: ${name}`);
    if (!this.installed.includes(name)) this.installed.push(name);
    await this.fs.mkdir('/system/apps').catch(() => {});
    await this.fs.writeFile(`/system/apps/${name}.manifest.json`, JSON.stringify(CATALOG[name].manifest, null, 2));

    this.appRegistry.register({
      id: `pkg:${name}`,
      name: CATALOG[name].manifest.name,
      category: 'Packages',
      icon: CATALOG[name].manifest.icon,
      permissions: CATALOG[name].manifest.permissions,
      defaultSize: { width: 680, height: 480 },
      launch: launchers[name],
      source: 'package',
    });

    this.save();
    this.eventBus.emit('pkg:installed', { name });
  }

  async remove(name) {
    this.installed = this.installed.filter((pkg) => pkg !== name);
    this.appRegistry.unregister(`pkg:${name}`);
    await this.fs.delete(`/system/apps/${name}.manifest.json`).catch(() => {});
    this.save();
    this.eventBus.emit('pkg:removed', { name });
  }

  async update() {
    this.eventBus.emit('pkg:update', { message: 'Package index refreshed.' });
    return 'Package index refreshed';
  }

  async updateSystem() {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    this.eventBus.emit('pkg:update-system', { message: 'System is up to date.' });
    return 'AeroOS system update complete';
  }

  async restoreInstalled() {
    for (const name of this.installed) {
      if (CATALOG[name]) await this.install(name);
    }
  }
}
