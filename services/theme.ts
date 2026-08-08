export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'yarmouk_app_theme';

export const getStoredTheme = (): ThemeMode => {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'dark' || value === 'light') {
      return value;
    }
  } catch (e) {}
  return 'dark'; // Default to dark theme as seen in screenshots
};

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
    document.body.classList.add('dark');
    document.body.style.backgroundColor = '#000000';
  } else {
    root.classList.remove('dark');
    document.body.classList.remove('dark');
    document.body.style.backgroundColor = '#F4F6FA';
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#000000' : '#1C1C2E');
  }

  window.dispatchEvent(
    new CustomEvent('theme-change', {
      detail: theme
    })
  );
};

export const initTheme = () => {
  applyTheme(getStoredTheme());
};

export const toggleTheme = (): ThemeMode => {
  const current = getStoredTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
};
