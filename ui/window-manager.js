export class WindowManager {
  constructor(eventBus, processManager) {
    this.eventBus = eventBus;
    this.processManager = processManager;
    this.layer = document.getElementById('window-layer');
    this.windows = new Map();
    this.z = 5;
    this.nextId = 1;
  }

  create(app, appContext) {
    const id = `w-${this.nextId++}`;
    const process = this.processManager.launch(app.id, { windowId: id });
    const frame = document.createElement('section');
    frame.className = 'window-frame';
    frame.dataset.windowId = id;
    frame.style.width = `${app.defaultSize?.width || 760}px`;
    frame.style.height = `${app.defaultSize?.height || 520}px`;
    frame.style.left = `${80 + (this.windows.size * 20)}px`;
    frame.style.top = `${64 + (this.windows.size * 20)}px`;

    frame.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title">${app.icon || '✨'} ${app.name}</div>
        <div class="window-controls">
          <button data-action="min">—</button>
          <button data-action="max">▢</button>
          <button data-action="close">✕</button>
        </div>
      </header>
      <div class="window-content"></div>
      <div class="resize-handle"></div>
    `;

    const state = { id, frame, app, process, minimized: false, maximized: false };
    this.windows.set(id, state);
    this.layer.appendChild(frame);
    this.focus(id);
    this.makeDraggable(state);
    this.makeResizable(state);
    this.bindControls(state);

    const mount = frame.querySelector('.window-content');
    app.launch({ ...appContext, mount, windowId: id, close: () => this.close(id) });

    this.eventBus.emit('window:opened', state);
    return id;
  }

  bindControls(state) {
    state.frame.querySelector('.window-controls').addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      if (action === 'min') this.minimize(state.id);
      if (action === 'max') this.maximize(state.id);
      if (action === 'close') this.close(state.id);
    });

    state.frame.addEventListener('mousedown', () => this.focus(state.id));
  }

  focus(id) {
    const state = this.windows.get(id);
    if (!state) return;
    state.frame.style.zIndex = ++this.z;
    this.eventBus.emit('window:focused', state);
  }

  minimize(id) {
    const state = this.windows.get(id);
    if (!state) return;
    state.minimized = true;
    state.frame.classList.add('minimized');
    this.eventBus.emit('window:minimized', state);
  }

  toggleMinimize(id) {
    const state = this.windows.get(id);
    if (!state) return;
    if (state.minimized) {
      state.minimized = false;
      state.frame.classList.remove('minimized');
      this.focus(id);
      return;
    }
    this.minimize(id);
  }

  maximize(id) {
    const state = this.windows.get(id);
    if (!state) return;
    state.maximized = !state.maximized;
    state.frame.classList.toggle('maximized', state.maximized);
    this.eventBus.emit('window:maximized', state);
  }

  close(id) {
    const state = this.windows.get(id);
    if (!state) return;
    state.frame.remove();
    this.windows.delete(id);
    this.processManager.stop(state.process.pid);
    this.eventBus.emit('window:closed', state);
  }

  makeDraggable(state) {
    const bar = state.frame.querySelector('.window-titlebar');
    let active = false;
    let offsetX = 0;
    let offsetY = 0;

    bar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.window-controls')) return;
      active = true;
      const rect = state.frame.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    window.addEventListener('mousemove', (e) => {
      if (!active || state.maximized) return;
      state.frame.style.left = `${Math.max(0, e.clientX - offsetX)}px`;
      state.frame.style.top = `${Math.max(0, e.clientY - offsetY)}px`;
    });

    window.addEventListener('mouseup', () => {
      active = false;
    });
  }

  makeResizable(state) {
    const handle = state.frame.querySelector('.resize-handle');
    let active = false;
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      active = true;
      const rect = state.frame.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      x = e.clientX;
      y = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!active || state.maximized) return;
      const w = Math.max(420, width + e.clientX - x);
      const h = Math.max(260, height + e.clientY - y);
      state.frame.style.width = `${w}px`;
      state.frame.style.height = `${h}px`;
    });

    window.addEventListener('mouseup', () => {
      active = false;
    });
  }
}
