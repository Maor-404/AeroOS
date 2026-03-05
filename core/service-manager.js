class BaseService {
  constructor(name, onTick) {
    this.name = name;
    this.onTick = onTick;
    this.timer = null;
    this.pid = null;
  }

  start(ctx) {
    if (this.timer) return;
    const process = ctx.processManager.spawnProcess(`service:${this.name}`, { service: this.name }, { system: true, priority: 2, memory: 18 });
    this.pid = process.pid;
    this.timer = setInterval(() => this.onTick?.(ctx), 1000);
    ctx.eventBus.emit('service:started', { name: this.name, pid: this.pid });
  }

  stop(ctx) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.pid) ctx.processManager.killProcess(this.pid);
    ctx.eventBus.emit('service:stopped', { name: this.name, pid: this.pid });
    this.pid = null;
  }

  restart(ctx) {
    this.stop(ctx);
    this.start(ctx);
  }
}

export class ServiceManager {
  constructor(eventBus, processManager) {
    this.eventBus = eventBus;
    this.processManager = processManager;
    this.services = [];
  }

  registerDefaults(networkLayer) {
    this.services = [
      new BaseService('ClockService', (ctx) => ctx.eventBus.emit('service:clock', { now: Date.now() })),
      new BaseService('NotificationService'),
      new BaseService('UpdateService'),
      new BaseService('FileWatcherService'),
      new BaseService('NetworkService', () => networkLayer.pulse()),
    ];
  }

  startAll() {
    const ctx = { eventBus: this.eventBus, processManager: this.processManager };
    this.services.forEach((service) => service.start(ctx));
  }

  stopAll() {
    const ctx = { eventBus: this.eventBus, processManager: this.processManager };
    this.services.forEach((service) => service.stop(ctx));
  }
}
