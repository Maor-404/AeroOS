export class MemoryManager {
  constructor(eventBus, totalMemoryMb = 4096) {
    this.eventBus = eventBus;
    this.totalMemoryMb = totalMemoryMb;
    this.allocations = new Map();
  }

  allocate(pid, amountMb) {
    const amount = Math.max(1, Number(amountMb) || 1);
    this.allocations.set(pid, amount);
    this.eventBus.emit('memory:changed', this.reportUsage());
  }

  free(pid) {
    this.allocations.delete(pid);
    this.eventBus.emit('memory:changed', this.reportUsage());
  }

  getProcessUsage(pid) {
    return this.allocations.get(pid) || 0;
  }

  reportUsage() {
    const usedMemoryMb = [...this.allocations.values()].reduce((sum, val) => sum + val, 0);
    return {
      totalMemoryMb: this.totalMemoryMb,
      usedMemoryMb,
      freeMemoryMb: Math.max(0, this.totalMemoryMb - usedMemoryMb),
      processMemory: Object.fromEntries(this.allocations.entries()),
    };
  }
}
