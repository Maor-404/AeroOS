export class NetworkLayer {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.connected = true;
    this.lastLatency = 0;
  }

  connect() {
    this.connected = true;
    this.eventBus.emit('network:state', { connected: true });
  }

  disconnect() {
    this.connected = false;
    this.eventBus.emit('network:state', { connected: false });
  }

  async fetch(url, options = {}) {
    if (!this.connected) throw new Error('Network disconnected');
    const start = performance.now();
    const response = await window.fetch(url, options);
    this.lastLatency = Math.round(performance.now() - start);
    this.eventBus.emit('network:request', { url, latency: this.lastLatency, ok: response.ok });
    return response;
  }

  async download(url) {
    const response = await this.fetch(url);
    return response.text();
  }

  pulse() {
    this.lastLatency = Math.round(10 + Math.random() * 120);
    this.eventBus.emit('network:pulse', { latency: this.lastLatency, connected: this.connected });
  }
}
