export type Theme = 'light' | 'dark';

const THEME_KEY = 'journey.theme';

export function getTheme(): Theme {
  const t = localStorage.getItem(THEME_KEY);
  return t === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
}

export function initTheme() {
  applyTheme(getTheme());
}
