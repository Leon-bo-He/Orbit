import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';

export interface TelegramConfig {
  configured: boolean;
  chatId: string | null;
  tokenSet: boolean;
}

export function useGetTelegramConfig() {
  return useQuery<TelegramConfig, ApiError>({
    queryKey: ['notifications', 'telegram'],
    queryFn: () => apiFetch<TelegramConfig>('/api/notifications/telegram'),
  });
}

export function useUpdateTelegramConfig() {
  const qc = useQueryClient();
  return useMutation<TelegramConfig, ApiError, { botToken: string | null; chatId: string | null }>({
    mutationFn: (body) =>
      apiFetch<TelegramConfig>('/api/notifications/telegram', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['notifications', 'telegram'], data);
    },
  });
}

export function useSendTelegramTest() {
  return useMutation<{ ok: boolean }, ApiError, void>({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/api/notifications/telegram/test', { method: 'POST' }),
  });
}
