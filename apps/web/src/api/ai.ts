import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface AiConfig {
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
}

export interface RssReport {
  content: string;
  cached: boolean;
}

export function useAiConfig() {
  return useQuery<AiConfig | null>({
    queryKey: ['ai-config'],
    queryFn: () => apiFetch<AiConfig | null>('/api/ai-config'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveAiConfig() {
  const qc = useQueryClient();
  return useMutation<void, Error, { baseUrl: string; apiKey: string; model: string }>({
    mutationFn: (body) =>
      apiFetch<void>('/api/ai-config', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-config'] }),
  });
}

export function useGenerateReport() {
  return useMutation<RssReport, Error, {
    feedUrl: string;
    feedName: string;
    reportType: 'daily' | 'weekly' | 'biweekly';
    force?: boolean;
  }>({
    mutationFn: (body) =>
      apiFetch<RssReport>('/api/rss-reports', { method: 'POST', body: JSON.stringify(body) }),
  });
}
