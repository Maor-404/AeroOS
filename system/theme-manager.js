const KEY = 'aeroos-theme';

export class ThemeManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  init() {
    const theme = localStorage.getItem(KEY) || 'aero';
    document.documentElement.dataset.theme = theme;
  }

  setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
    this.eventBus.emit('theme:changed', { theme });
  }
}
