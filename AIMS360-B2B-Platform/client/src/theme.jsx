import { useEffect, useState } from 'react';

// Light / dark theme. Follows the device setting until the person picks one.
function initial() {
  try {
    const saved = localStorage.getItem('b2b-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  const host = document.documentElement.dataset.theme;
  if (host === 'light' || host === 'dark') return host;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('b2b-theme', next);
      } catch {
        /* keep for this visit only */
      }
      return next;
    });
  return { theme, toggle };
}

export function ThemeToggle({ theme, toggle }) {
  const dark = theme === 'dark';
  return (
    <button className="btn icon" onClick={toggle} type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}

export function Wordmark({ sub = 'B2B Wholesale' }) {
  return (
    <span className="brand">
      <span className="word">AIMS360</span>
      <span className="sub">{sub}</span>
    </span>
  );
}
