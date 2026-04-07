import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';
import type { AuthUser } from '../store/auth.store.js';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
}

export function useLogin() {
  return useMutation<AuthResponse, ApiError, { email: string; password: string }>({
    mutationFn: (body) =>
      apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useRegister() {
  return useMutation<AuthResponse, ApiError, { email: string; name: string; password: string }>({
    mutationFn: (body) =>
      apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useLogout() {
  return useMutation<{ ok: boolean }, ApiError, void>({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  });
}

export function useRefreshToken() {
  return useMutation<RefreshResponse, ApiError, void>({
    mutationFn: () =>
      apiFetch<RefreshResponse>('/api/auth/refresh', { method: 'POST' }),
  });
}

export function useMe(accessToken: string | null) {
  return useQuery<AuthUser, ApiError>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<AuthUser>('/api/auth/me'),
    enabled: !!accessToken,
    retry: false,
  });
}
