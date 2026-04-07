import { useEffect, useRef, useState } from 'react';
import { useRefreshToken, useMe } from '../../api/auth.js';
import { useAuthStore } from '../../store/auth.store.js';
import { setAccessToken } from '../../api/client.js';
import { FullPageSpinner } from '../ui/FullPageSpinner.js';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const storedToken = useAuthStore((s) => s.accessToken);

  const [isLoading, setIsLoading] = useState(true);
  // refreshedToken is the token obtained from the refresh call (may differ from stored)
  const [refreshedToken, setRefreshedToken] = useState<string | null>(null);

  const refreshMutation = useRefreshToken();
  // useMe is enabled only once we have a token from refresh
  const meQuery = useMe(refreshedToken);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Restore stored token into the in-memory variable so apiFetch can use it
    // while we attempt to refresh
    if (storedToken) {
      setAccessToken(storedToken);
    }

    refreshMutation.mutate(undefined, {
      onSuccess: (data) => {
        setAccessToken(data.accessToken);
        setRefreshedToken(data.accessToken);
        // meQuery will fire once refreshedToken is set
      },
      onError: () => {
        clearAuth();
        setIsLoading(false);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once meQuery resolves after a successful refresh
  useEffect(() => {
    if (!refreshedToken) return;
    if (meQuery.isLoading) return;

    if (meQuery.data) {
      setAuth(meQuery.data, refreshedToken);
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
