export class ContextMenu {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.node = document.getElementById('context-menu');
  }

  init(itemsProvider) {
    this.itemsProvider = itemsProvider;
    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('#aero-os')) return;
      e.preventDefault();
      this.open(e.clientX, e.clientY);
    });

    document.addEventListener('click', () => this.close());
  }

  open(x, y) {
    const items = this.itemsProvider();
    this.node.innerHTML = '';
    items.forEach((item) => {
      const button = document.createElement('button');
      button.textContent = item.label;
      button.addEventListener('click', () => {
        item.action();
        this.close();
      });
      this.node.appendChild(button);
    });
    this.node.style.left = `${x}px`;
    this.node.style.top = `${y}px`;
    this.node.classList.remove('hidden');
  }

  close() {
    this.node.classList.add('hidden');
  }
}
