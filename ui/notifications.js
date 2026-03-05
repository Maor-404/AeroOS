export class NotificationCenter {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = document.getElementById('notifications');
  }

  notify(message, type = 'info', timeout = 3500) {
    const card = document.createElement('div');
    card.className = `notification ${type}`;
    card.innerHTML = `<strong>${type.toUpperCase()}</strong><p>${message}</p>`;
    this.container.appendChild(card);
    requestAnimationFrame(() => card.classList.add('show'));
    setTimeout(() => {
      card.classList.remove('show');
      setTimeout(() => card.remove(), 200);
    }, timeout);
  }

  wire() {
    this.eventBus.on('notify', ({ message, type }) => this.notify(message, type));
  }
}
