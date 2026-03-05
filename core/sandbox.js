export class SandboxFactory {
  constructor({ fs, events, windowManager, permissions, packageManager, processManager, scheduler, network, memoryManager, userProfiles }) {
    this.fs = fs;
    this.events = events;
    this.windowManager = windowManager;
    this.permissions = permissions;
    this.packageManager = packageManager;
    this.processManager = processManager;
    this.scheduler = scheduler;
    this.network = network;
    this.memoryManager = memoryManager;
    this.userProfiles = userProfiles;
  }

  create(appId) {
    const guard = async (permission) => {
      const ok = await this.permissions.request(appId, permission);
      if (!ok) throw new Error(`Permission denied: ${permission}`);
    };

    return {
      filesystem: {
        read: async (path) => {
          await guard('filesystem.read');
          return this.fs.readFile(path);
        },
        write: async (path, content) => {
          await guard('filesystem.write');
          return this.fs.writeFile(path, content);
        },
        list: async (path) => {
          await guard('filesystem.read');
          return this.fs.list(path);
        },
      },
      notifications: {
        notify: async (message, type = 'info') => {
          await guard('notifications');
          this.events.emit('notify', { message, type });
        },
      },
      window: {
        open: (id) => this.windowManager.toggleMinimize(id),
      },
      process: {
        list: () => this.processManager.listProcesses(),
        kill: (pid) => this.processManager.killProcess(pid),
      },
      scheduler: {
        setAlgorithm: (algo) => this.scheduler.setAlgorithm(algo),
      },
      memory: {
        report: () => this.memoryManager.reportUsage(),
      },
      network: {
        fetch: (...args) => this.network.fetch(...args),
      },

      user: {
        profile: () => this.userProfiles.getProfile(),
        save: (profile) => this.userProfiles.save(profile),
      },
      aeropkg: {
        install: (name) => this.packageManager.install(name),
        remove: (name) => this.packageManager.remove(name),
        list: () => this.packageManager.list(),
        update: () => this.packageManager.update(),
        updateSystem: () => this.packageManager.updateSystem(),
      },
      events: {
        on: (...args) => this.events.on(...args),
        emit: (...args) => this.events.emit(...args),
      },
    };
  }
}
