import { useEffect, useRef, useState } from 'react';
import { useMe } from '../../api/auth.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useUiStore } from '../../store/ui.store.js';
import { apiFetch, setAccessToken } from '../../api/client.js';
import { FullPageSpinner } from '../ui/FullPageSpinner.js';
import { useTheme } from '../../hooks/useTheme.js';
import i18n from '../../i18n/index.js';

/** Decode a JWT and check whether its exp claim is in the future. */
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  useTheme();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const storedToken = useAuthStore((s) => s.accessToken);
  const setLocale = useUiStore((s) => s.setLocale);
  const setTheme = useUiStore((s) => s.setTheme);

  const [isLoading, setIsLoading] = useState(true);
  // refreshedToken is the token obtained from the refresh call (may differ from stored)
  const [refreshedToken, setRefreshedToken] = useState<string | null>(null);

  // useMe is enabled only once we have a token from refresh
  const meQuery = useMe(refreshedToken);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Restore stored token into memory so API calls work immediately
    if (storedToken) {
      setAccessToken(storedToken);
    }

    // If the stored token is still valid, skip the refresh round-trip.
    // useMe will verify the user and restore the session.
    if (storedToken && isTokenValid(storedToken)) {
      setRefreshedToken(storedToken);
      return;
    }

    // Token missing or expired — use the httpOnly refresh cookie to get a new one.
    // Abort after 3 s so a slow/cold server doesn't block the login page.
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      clearAuth();
      setIsLoading(false);
    }, 3000);

    apiFetch<{ accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      signal: controller.signal,
    })
      .then((data) => {
        clearTimeout(timeout);
        setAccessToken(data.accessToken);
        setRefreshedToken(data.accessToken);
      })
      .catch(() => {
        clearTimeout(timeout);
        clearAuth();
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once meQuery resolves after a successful refresh
  useEffect(() => {
    if (!refreshedToken) return;
    if (meQuery.isLoading) return;

    if (meQuery.data) {
      setAuth(meQuery.data, refreshedToken);
      if (meQuery.data.locale) {
        setLocale(meQuery.data.locale as Parameters<typeof setLocale>[0]);
        void i18n.changeLanguage(meQuery.data.locale);
      }
      if (meQuery.data.appearance) {
        setTheme(meQuery.data.appearance as Parameters<typeof setTheme>[0]);
      }
    } else if (meQuery.isError) {
      clearAuth();
    }
    setIsLoading(false);
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, refreshedToken, setAuth, clearAuth]);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
