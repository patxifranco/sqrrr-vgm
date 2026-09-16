const ThemeManager = {
  THEMES: { XP: 'xp', AERO: 'aero' },

  init() {
    const saved = localStorage.getItem('userTheme') || 'xp';
    this.apply(saved);
  },

  apply(theme) {
    const xpLink = document.getElementById('theme-xp');
    const aeroLink = document.getElementById('theme-aero');

    if (theme === 'aero') {
      if (xpLink) xpLink.disabled = true;
      if (aeroLink) aeroLink.disabled = false;
      document.body.classList.add('theme-aero');
      document.body.classList.remove('theme-xp');
    } else {
      if (aeroLink) aeroLink.disabled = true;
      if (xpLink) xpLink.disabled = false;
      document.body.classList.add('theme-xp');
      document.body.classList.remove('theme-aero');
    }

    localStorage.setItem('userTheme', theme);

    this.syncSelectors();
  },

  toggle() {
    const current = localStorage.getItem('userTheme') || 'xp';
    this.apply(current === 'xp' ? 'aero' : 'xp');
  },

  get() {
    return localStorage.getItem('userTheme') || 'xp';
  },

  syncSelectors() {
    const currentTheme = this.get();
    document.querySelectorAll('.theme-selector').forEach(select => {
      select.value = currentTheme;
    });
  }
};

window.ThemeManager = ThemeManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
  ThemeManager.init();
}

document.addEventListener('change', (e) => {
  if (e.target.classList.contains('theme-selector')) {
    ThemeManager.apply(e.target.value);
  }
});
