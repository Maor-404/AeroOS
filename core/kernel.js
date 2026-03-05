import { EventBus } from './event-bus.js';
import { ProcessManager } from './process-manager.js';
import { FileSystem } from './filesystem.js';
import { PermissionManager } from './permissions.js';
import { MemoryManager } from './memory-manager.js';
import { Scheduler } from './scheduler.js';
import { ServiceManager } from './service-manager.js';
import { PackageManager } from './package-manager.js';
import { NetworkLayer } from './network.js';
import { SandboxFactory } from './sandbox.js';
import { UserProfileService } from './user-profile.js';
import { AppRegistry } from '../system/app-registry.js';
import { IconLoader } from '../system/icon-loader.js';
import { ThemeManager } from '../system/theme-manager.js';
import { Desktop } from '../ui/desktop.js';
import { WindowManager } from '../ui/window-manager.js';
import { Taskbar } from '../ui/taskbar.js';
import { StartMenu } from '../ui/startmenu.js';
import { ContextMenu } from '../ui/context-menu.js';
import { NotificationCenter } from '../ui/notifications.js';
import { UserSetup } from '../ui/user-setup.js';
import { terminalApp } from '../apps/terminal/index.js';
import { fileManagerApp } from '../apps/filemanager/index.js';
import { textEditorApp } from '../apps/texteditor/index.js';
import { settingsApp } from '../apps/settings/index.js';
import { browserApp } from '../apps/browser/index.js';
import { taskManagerApp } from '../apps/taskmanager/index.js';
import { systemMonitorApp } from '../apps/systemmonitor/index.js';

const FILE_ASSOC = {
  '.txt': 'texteditor',
  '.md': 'texteditor',
  '.json': 'texteditor',
  '.png': 'browser',
};

export class Kernel {
  constructor() {
    this.events = new EventBus();
    this.memory = new MemoryManager(this.events);
    this.processes = new ProcessManager(this.events, this.memory);
    this.permissions = new PermissionManager(this.events);
    this.fs = new FileSystem(this.events);
    this.registry = new AppRegistry(this.events);
    this.icons = new IconLoader();
    this.theme = new ThemeManager(this.events);
    this.network = new NetworkLayer(this.events);
    this.windowManager = new WindowManager(this.events, this.processes);
    this.desktop = new Desktop(this.events, this.fs, this.icons);
    this.taskbar = new Taskbar(this.events);
    this.startMenu = new StartMenu(this.events, this.registry);
    this.contextMenu = new ContextMenu(this.events);
    this.notifications = new NotificationCenter(this.events);
    this.scheduler = new Scheduler(this.events, this.processes);
    this.services = new ServiceManager(this.events, this.processes);
    this.packages = new PackageManager(this.events, this.fs, this.registry);
    this.userProfiles = new UserProfileService(this.events);
    this.userSetup = new UserSetup(this.events, this.userProfiles, this.theme);
    this.sandboxFactory = new SandboxFactory({
      fs: this.fs,
      events: this.events,
      windowManager: this.windowManager,
      permissions: this.permissions,
      packageManager: this.packages,
      processManager: this.processes,
      scheduler: this.scheduler,
      network: this.network,
      memoryManager: this.memory,
      userProfiles: this.userProfiles,
    });
  }

  exposePublicApi() {
    return {
      registerApp: (config) => this.registerExternalApp(config),
      createApp: (config) => this.registerExternalApp(config),
      listApps: () => this.registry.list(),
      openApp: (id) => this.openApp(id),
      fs: this.fs,
      events: this.events,
      api: this.sandboxFactory.create('developer-sdk'),
      user: {
        getProfile: () => this.userProfiles.getProfile(),
        saveProfile: (profile) => this.userProfiles.save(profile),
        configureSupabase: (cfg) => this.userProfiles.configure(cfg),
      },
    };
  }

  registerExternalApp(config) {
    const normalized = {
      ...config,
      id: config.id || `external:${config.name?.toLowerCase().replace(/\s+/g, '-')}`,
      category: config.category || 'External',
      icon: config.icon || '🧩',
      launch: config.launch,
      permissions: config.permissions || [],
    };
    this.permissions.registerApp(normalized.id, normalized.permissions);
    this.registry.register(normalized);
  }

  async boot() {
    await this.animateBoot([
      'Initializing Kernel...',
      'Mounting Filesystem...',
      'Starting Services...',
      'Launching Desktop Environment...',
      'Welcome to AeroOS',
    ]);
    this.theme.init();
    await this.userSetup.init();
    await this.fs.init();
    await this.seedUserFiles();

    this.registerApps();
    await this.packages.restoreInstalled();

    this.services.registerDefaults(this.network);
    this.services.startAll();
    this.scheduler.start(700);

    this.taskbar.init({ onStart: () => this.startMenu.toggle(), onTaskClick: (id) => this.windowManager.toggleMinimize(id) });
    this.startMenu.init((appId) => this.openApp(appId));

    this.contextMenu.init(() => [
      { label: 'New Folder', action: () => this.createDesktopFolder() },
      { label: 'Refresh', action: () => this.desktop.syncIcons() },
      { label: 'Change Wallpaper', action: () => this.promptWallpaper() },
      { label: 'Open Terminal', action: () => this.openApp('terminal') },
    ]);

    await this.desktop.init({
      onOpenApp: (id) => this.openApp(id),
      onOpenPath: (path) => this.openPath(path),
      onOpenTerminal: () => this.openApp('terminal'),
      onChangeWallpaper: () => this.promptWallpaper(),
    });

    this.notifications.wire();

    const wallpaper = localStorage.getItem('aeroos-wallpaper') || 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=1920&auto=format&fit=crop';
    this.desktop.setWallpaper(wallpaper);
    this.events.on('wallpaper:changed', ({ url }) => this.desktop.setWallpaper(url));

    this.events.emit('notify', { message: 'Welcome to AeroOS', type: 'info' });
  }

  async animateBoot(lines) {
    const boot = document.getElementById('boot-screen');
    const bar = boot.querySelector('.boot-progress span');
    const log = boot.querySelector('.boot-log');

    for (const line of lines) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      log.textContent += `${line}\n`;
    }

    await new Promise((resolve) => {
      setTimeout(() => {
        bar.style.width = '100%';
      }, 100);
      setTimeout(resolve, 900);
    });

    boot.classList.add('hidden');
    document.getElementById('aero-os').classList.remove('hidden');
  }

  registerApps() {
    [terminalApp, fileManagerApp, textEditorApp, settingsApp, browserApp, taskManagerApp, systemMonitorApp].forEach((app) => {
      app.icon = app.icon || this.icons.get(app.id);
      this.permissions.registerApp(app.id, app.permissions || []);
      this.registry.register(app);
    });
  }

  appContext(appId) {
    return {
      services: {
        fs: this.fs,
        events: this.events,
        theme: this.theme,
        processes: this.processes,
        scheduler: this.scheduler,
        memory: this.memory,
        packages: this.packages,
        user: this.userProfiles,
      },
      api: this.sandboxFactory.create(appId),
    };
  }

  openApp(appId) {
    const app = this.registry.get(appId);
    if (!app) throw new Error(`Unknown app ${appId}`);
    this.windowManager.create(app, this.appContext(appId));
  }

  async openPath(path) {
    const node = await this.fs.getNode(path);
    if (!node) return;
    if (node.type === 'dir') {
      this.openApp('filemanager');
      return;
    }

    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    const preferred = FILE_ASSOC[ext] || 'texteditor';
    this.openApp(preferred);
  }

  async createDesktopFolder() {
    const name = prompt('Folder name', `New Folder ${Date.now().toString().slice(-4)}`);
    if (!name) return;
    await this.fs.mkdir(`/home/user/Desktop/${name}`);
  }

  promptWallpaper() {
    const url = prompt('Wallpaper URL');
    if (!url) return;
    localStorage.setItem('aeroos-wallpaper', url);
    this.events.emit('wallpaper:changed', { url });
  }

  async seedUserFiles() {
    const doc = await this.fs.getNode('/home/user/Documents/readme.txt');
    if (!doc) {
      await this.fs.writeFile('/home/user/Documents/readme.txt', 'Welcome to AeroOS\nUse Terminal and File Manager to explore.');
    }
  }
}
