export class Taskbar {
  constructor(eventBus, clock = () => new Date()) {
    this.eventBus = eventBus;
    this.clock = clock;
    this.node = document.getElementById('taskbar');
    this.running = new Map();
  }

  init({ onStart, onTaskClick }) {
    this.node.innerHTML = `
      <button id="start-button">Start</button>
      <div id="task-list"></div>
      <div id="taskbar-right">
        <img id="taskbar-avatar" alt="user avatar" src="./assets/icons/avatar-aero.svg" />
        <span id="taskbar-user">Aero User</span>
        <span id="clock"></span>
      </div>
    `;

    this.node.querySelector('#start-button').addEventListener('click', onStart);
    this.taskList = this.node.querySelector('#task-list');
    this.clockNode = this.node.querySelector('#clock');
    this.avatarNode = this.node.querySelector('#taskbar-avatar');
    this.userNode = this.node.querySelector('#taskbar-user');
    this.onTaskClick = onTaskClick;

    setInterval(() => this.renderClock(), 1000);
    this.renderClock();

    this.eventBus.on('window:opened', (state) => this.addTask(state));
    this.eventBus.on('window:closed', (state) => this.removeTask(state.id));
    this.eventBus.on('user:ready', (profile) => this.setUser(profile));
  }

  setUser(profile) {
    this.userNode.textContent = profile.displayName || 'Aero User';
    this.avatarNode.src = profile.avatar || './assets/icons/avatar-aero.svg';
  }

  renderClock() {
    this.clockNode.textContent = this.clock().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  addTask(state) {
    const btn = document.createElement('button');
    btn.className = 'task-item';
    btn.textContent = `${state.app.icon || '✨'} ${state.app.name}`;
    btn.addEventListener('click', () => this.onTaskClick(state.id));
    this.taskList.appendChild(btn);
    this.running.set(state.id, btn);
  }

  removeTask(windowId) {
    const btn = this.running.get(windowId);
    if (!btn) return;
    btn.remove();
    this.running.delete(windowId);
  }
}
