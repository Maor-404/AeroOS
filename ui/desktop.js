import { pathUtils } from '../core/filesystem.js';

export class Desktop {
  constructor(eventBus, fileSystem, iconLoader) {
    this.eventBus = eventBus;
    this.fileSystem = fileSystem;
    this.iconLoader = iconLoader;
    this.node = document.getElementById('desktop-icons');
    this.selection = document.getElementById('selection-box');
    this.wallpaper = document.getElementById('wallpaper');
  }

  async init({ onOpenApp, onOpenPath, onOpenTerminal, onChangeWallpaper }) {
    this.handlers = { onOpenApp, onOpenPath, onOpenTerminal, onChangeWallpaper };
    await this.syncIcons();
    this.bindSelection();
    this.bindBubbles();

    this.eventBus.on('fs:created', () => this.syncIcons());
    this.eventBus.on('fs:deleted', () => this.syncIcons());
  }

  async syncIcons() {
    const entries = await this.fileSystem.list('/home/user/Desktop');
    this.node.innerHTML = '';

    const baseIcons = [
      { id: 'terminal', label: 'Terminal', icon: this.iconLoader.get('terminal'), action: () => this.handlers.onOpenApp('terminal') },
      { id: 'filemanager', label: 'Files', icon: this.iconLoader.get('filemanager'), action: () => this.handlers.onOpenApp('filemanager') },
      { id: 'settings', label: 'Settings', icon: this.iconLoader.get('settings'), action: () => this.handlers.onOpenApp('settings') },
      { id: 'browser', label: 'Browser', icon: this.iconLoader.get('browser'), action: () => this.handlers.onOpenApp('browser') },
    ];

    const dynamic = entries.map((node) => ({
      id: node.path,
      label: pathUtils.basename(node.path),
      icon: this.iconLoader.get(node.type === 'dir' ? 'folder' : 'file'),
      action: () => this.handlers.onOpenPath(node.path),
    }));

    [...baseIcons, ...dynamic].forEach((icon, idx) => {
      const el = document.createElement('button');
      el.className = 'desktop-icon';
      el.style.left = `${16 + (idx % 7) * 92}px`;
      el.style.top = `${20 + Math.floor(idx / 7) * 96}px`;
      el.innerHTML = `<span>${icon.icon}</span><small>${icon.label}</small>`;
      el.addEventListener('dblclick', icon.action);
      this.node.appendChild(el);
    });
  }

  bindSelection() {
    let active = false;
    let sx = 0;
    let sy = 0;

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.desktop-icon') || e.target.closest('.window-frame')) return;
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      this.selection.style.left = `${sx}px`;
      this.selection.style.top = `${sy}px`;
      this.selection.style.width = '0px';
      this.selection.style.height = '0px';
      this.selection.classList.add('active');
    });

    document.addEventListener('mousemove', (e) => {
      if (!active) return;
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      const w = Math.abs(sx - e.clientX);
      const h = Math.abs(sy - e.clientY);
      Object.assign(this.selection.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    });

    document.addEventListener('mouseup', () => {
      active = false;
      this.selection.classList.remove('active');
    });
  }

  bindBubbles() {
    const layer = document.getElementById('bubble-layer');
    for (let i = 0; i < 16; i += 1) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.style.left = `${Math.random() * 100}%`;
      bubble.style.animationDelay = `${Math.random() * 7}s`;
      bubble.style.animationDuration = `${8 + Math.random() * 10}s`;
      layer.appendChild(bubble);
    }
  }

  setWallpaper(url) {
    this.wallpaper.style.backgroundImage = `url(${url})`;
  }
}
