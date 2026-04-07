import { useEffect } from 'react';
import { useUiStore } from '../store/ui.store.js';

/**
 * Applies the user's theme preference to <html class="dark">.
 * Call once near the app root.
 */
export function useTheme() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      return;
    }

    if (theme === 'light') {
      root.classList.remove('dark');
      return;
    }

    // system — follow prefers-color-scheme
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) => root.classList.toggle('dark', dark);
    apply(mq.matches);
    mq.addEventListener('change', (e) => apply(e.matches));
    return () => mq.removeEventListener('change', (e) => apply(e.matches));
  }, [theme]);
}
