export class IconLoader {
  constructor() {
    this.defaults = {
      terminal: '🖥️',
      filemanager: '📁',
      texteditor: '📝',
      settings: '⚙️',
      browser: '🌐',
      taskmanager: '📊',
      systemmonitor: '🛰️',
      folder: '📂',
      file: '📄',
    };
  }

  get(name) {
    return this.defaults[name] || '✨';
  }
}
