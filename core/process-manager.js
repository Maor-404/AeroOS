export class ProcessManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.nextPid = 100;
    this.processes = new Map();
  }

  launch(appId, metadata = {}) {
    const pid = this.nextPid++;
    const process = {
      pid,
      appId,
      startedAt: new Date().toISOString(),
      state: 'running',
      metadata,
    };
    this.processes.set(pid, process);
    this.eventBus.emit('process:started', process);
    return process;
  }

  stop(pid) {
    const process = this.processes.get(pid);
    if (!process) return;
    process.state = 'stopped';
    process.stoppedAt = new Date().toISOString();
    this.eventBus.emit('process:stopped', process);
    this.processes.delete(pid);
  }

  list() {
    return [...this.processes.values()];
  }
}
