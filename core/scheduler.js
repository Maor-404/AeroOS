const ALGORITHMS = {
  RR: 'round-robin',
  PRIORITY: 'priority',
  FCFS: 'fcfs',
};

export class Scheduler {
  constructor(eventBus, processManager) {
    this.eventBus = eventBus;
    this.processManager = processManager;
    this.algorithm = ALGORITHMS.RR;
    this.interval = null;
    this.pointer = 0;
  }

  start(sliceMs = 500) {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), sliceMs);
    this.eventBus.emit('scheduler:started', { sliceMs, algorithm: this.algorithm });
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
    this.eventBus.emit('scheduler:stopped');
  }

  setAlgorithm(algorithm) {
    if (!Object.values(ALGORITHMS).includes(algorithm)) return;
    this.algorithm = algorithm;
    this.eventBus.emit('scheduler:algorithm', { algorithm });
  }

  tick() {
    const processes = this.processManager.listProcesses().filter((p) => p.state !== 'terminated' && p.state !== 'sleeping');
    if (!processes.length) return;

    let current;
    if (this.algorithm === ALGORITHMS.PRIORITY) {
      current = [...processes].sort((a, b) => a.priority - b.priority)[0];
    } else if (this.algorithm === ALGORITHMS.FCFS) {
      current = [...processes].sort((a, b) => a.startedAt - b.startedAt)[0];
    } else {
      current = processes[this.pointer % processes.length];
      this.pointer += 1;
    }

    const cpu = Number((Math.random() * 40 + 3).toFixed(1));
    this.processManager.updateRuntimeStats(current.pid, cpu);
    this.eventBus.emit('scheduler:tick', {
      pid: current.pid,
      algorithm: this.algorithm,
      cpu,
      timestamp: Date.now(),
    });
  }
}

export { ALGORITHMS };
