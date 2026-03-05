export class IconLoader {
  constructor() {
    this.defaults = {
      terminal: '🖥️',
      filemanager: '📁',
      texteditor: '📝',
      settings: '⚙️',
      browser: '🌐',
      folder: '📂',
      file: '📄',
    };
  }

  get(name) {
    return this.defaults[name] || '✨';
  }
}
