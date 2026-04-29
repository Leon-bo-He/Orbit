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
  return useMutation<void, Error, { baseUrl: string; apiKey?: string; model: string }>({
    mutationFn: (body) =>
      apiFetch<void>('/api/ai-config', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-config'] }),
  });
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
}

export function useTestAiConnection() {
  return useMutation<TestConnectionResult, Error, { baseUrl?: string; apiKey?: string; model?: string }>({
    mutationFn: (body) =>
      apiFetch<TestConnectionResult>('/api/ai-config/test', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useTranslateTitles() {
  return useMutation<{ translations: string[] }, Error, { titles: string[]; targetLanguage: string }>({
    mutationFn: (body) =>
      apiFetch<{ translations: string[] }>('/api/ai-translate', { method: 'POST', body: JSON.stringify(body) }),
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
