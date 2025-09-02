export type Theme = 'light' | 'dark' | 'auto';

const THEME_KEY = 'journey.theme';

export function getTheme(): Theme {
  const t = localStorage.getItem(THEME_KEY) as Theme | null;
  return t || 'auto';
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme === 'auto' ? 'auto' : theme);
}

export function initTheme() {
  applyTheme(getTheme());
}

