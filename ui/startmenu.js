export class StartMenu {
  constructor(eventBus, appRegistry) {
    this.eventBus = eventBus;
    this.appRegistry = appRegistry;
    this.node = document.getElementById('start-menu');
  }

  init(onLaunch) {
    this.onLaunch = onLaunch;
    this.render('');
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#start-menu') && !e.target.closest('#start-button')) {
        this.hide();
      }
    });
  }

  toggle() {
    this.node.classList.toggle('hidden');
  }

  hide() {
    this.node.classList.add('hidden');
  }

  render(query) {
    const apps = this.appRegistry.search(query);
    this.node.innerHTML = `
      <div class="start-header">
        <input id="start-search" type="search" placeholder="Search apps" value="${query}" />
      </div>
      <div class="start-app-list"></div>
      <div class="start-footer">
        <button data-action="restart">Restart</button>
        <button data-action="shutdown">Shutdown</button>
      </div>
    `;

    const list = this.node.querySelector('.start-app-list');
    apps.forEach((app) => {
      const item = document.createElement('button');
      item.className = 'start-app';
      item.innerHTML = `<span>${app.icon}</span><div><strong>${app.name}</strong><small>${app.category}</small></div>`;
      item.addEventListener('click', () => {
        this.onLaunch(app.id);
        this.hide();
      });
      list.appendChild(item);
    });

    this.node.querySelector('#start-search').addEventListener('input', (e) => this.render(e.target.value));

    this.node.querySelector('.start-footer').addEventListener('click', (e) => {
      if (e.target.dataset.action === 'shutdown') {
        this.eventBus.emit('notify', { message: 'AeroOS shutdown is simulated only.', type: 'info' });
      }
      if (e.target.dataset.action === 'restart') {
        location.reload();
      }
    });
  }
}
