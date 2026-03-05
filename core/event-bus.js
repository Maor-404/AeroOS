export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    const pool = this.handlers.get(event);
    pool.add(handler);
    return () => pool.delete(handler);
  }

  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
  }

  emit(event, payload = {}) {
    const pool = this.handlers.get(event);
    if (!pool) return;
    pool.forEach((handler) => handler(payload));
  }
}
