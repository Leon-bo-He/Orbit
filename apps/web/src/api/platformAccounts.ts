import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';

export type PlatformId =
  | 'douyin'
  | 'rednote'
  | 'wechat_video'
  | 'bilibili'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'x';

export type CookieStatus = 'valid' | 'invalid' | 'unknown' | 'checking';

export interface PlatformAccount {
  id: string;
  userId: string;
  platform: PlatformId;
  accountName: string;
  displayName: string | null;
  cookieStatus: CookieStatus;
  cookieCheckedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountResponse {
  account: PlatformAccount;
  missingDomains: string[];
}

export function usePlatformAccounts(platform?: PlatformId) {
  const qs = platform ? `?platform=${platform}` : '';
  return useQuery<PlatformAccount[], ApiError>({
    queryKey: ['platformAccounts', platform ?? 'all'],
    queryFn: () => apiFetch<PlatformAccount[]>(`/api/platform-accounts${qs}`),
  });
}

export function useCreatePlatformAccount() {
  const qc = useQueryClient();
  return useMutation<
    CreateAccountResponse,
    ApiError,
    { platform: PlatformId; accountName: string; displayName?: string | null; cookies: string }
  >({
    mutationFn: (body) =>
      apiFetch<CreateAccountResponse>('/api/platform-accounts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platformAccounts'] });
    },
  });
}

export function useReplaceCookies() {
  const qc = useQueryClient();
  return useMutation<CreateAccountResponse, ApiError, { id: string; cookies: string }>({
    mutationFn: ({ id, cookies }) =>
      apiFetch<CreateAccountResponse>(`/api/platform-accounts/${id}/cookies`, {
        method: 'PATCH',
        body: JSON.stringify({ cookies }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platformAccounts'] });
    },
  });
}

export function useRecheckPlatformAccount() {
  const qc = useQueryClient();
  return useMutation<{ valid: boolean; reason?: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<{ valid: boolean; reason?: string }>(`/api/platform-accounts/${id}/check`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platformAccounts'] });
    },
  });
}

export function useRenamePlatformAccount() {
  const qc = useQueryClient();
  return useMutation<
    PlatformAccount,
    ApiError,
    { id: string; accountName?: string; displayName?: string | null }
  >({
    mutationFn: ({ id, ...body }) =>
      apiFetch<PlatformAccount>(`/api/platform-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platformAccounts'] });
    },
  });
}

export function useDeletePlatformAccount() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/platform-accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platformAccounts'] });
    },
  });
}
