const STATES = ['running', 'sleeping', 'waiting', 'terminated'];

const rand = (min, max) => Math.round(min + Math.random() * (max - min));

export class ProcessManager {
  constructor(eventBus, memoryManager) {
    this.eventBus = eventBus;
    this.memoryManager = memoryManager;
    this.nextPid = 100;
    this.processes = new Map();
  }

  spawnProcess(name, metadata = {}, options = {}) {
    const pid = this.nextPid++;
    const memory = options.memory ?? rand(12, 64);
    const process = {
      pid,
      name,
      state: 'running',
      priority: options.priority ?? 5,
      cpuUsage: 0,
      memoryUsage: memory,
      threads: options.threads ?? 1,
      startedAt: Date.now(),
      metadata,
      system: Boolean(options.system),
      launchedBy: options.launchedBy || 'kernel',
    };

    this.memoryManager.allocate(pid, memory);
    this.processes.set(pid, process);
    this.eventBus.emit('process:spawned', process);
    return process;
  }

  // Backward compatibility for existing callers.
  launch(appId, metadata = {}) {
    return this.spawnProcess(appId, metadata, { launchedBy: appId });
  }

  killProcess(pid) {
    const process = this.processes.get(pid);
    if (!process) return false;
    process.state = 'terminated';
    this.memoryManager.free(pid);
    this.eventBus.emit('process:killed', process);
    this.processes.delete(pid);
    return true;
  }

  stop(pid) {
    this.killProcess(pid);
  }

  suspendProcess(pid) {
    const process = this.processes.get(pid);
    if (!process || process.state === 'terminated') return false;
    process.state = 'sleeping';
    this.eventBus.emit('process:suspended', process);
    return true;
  }

  resumeProcess(pid) {
    const process = this.processes.get(pid);
    if (!process || process.state === 'terminated') return false;
    process.state = 'running';
    this.eventBus.emit('process:resumed', process);
    return true;
  }

  updateRuntimeStats(pid, cpuUsage) {
    const process = this.processes.get(pid);
    if (!process) return;
    process.cpuUsage = cpuUsage;
    process.memoryUsage = this.memoryManager.getProcessUsage(pid);
    this.eventBus.emit('process:updated', process);
  }

  listProcesses() {
    return [...this.processes.values()].map((p) => ({ ...p }));
  }

  list() {
    return this.listProcesses();
  }

  isValidState(state) {
    return STATES.includes(state);
  }
}
