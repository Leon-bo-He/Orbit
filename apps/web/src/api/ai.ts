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
  createdAt: string;
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

export function useTranslateText() {
  return useMutation<{ translated: string }, Error, { text: string; targetLanguage: string }>({
    mutationFn: (body) =>
      apiFetch<{ translated: string }>('/api/ai-translate-text', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useTranslateTitles() {
  return useMutation<{ translations: string[] }, Error, { titles: string[]; targetLanguage: string }>({
    mutationFn: (body) =>
      apiFetch<{ translations: string[] }>('/api/ai-translate', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useGetReport(feedUrl: string, feedName: string, reportType: 'daily' | 'weekly' | 'biweekly') {
  const qc = useQueryClient();
  const queryKey = ['rss-report', feedUrl, reportType];
  const [polling, setPolling] = useState(false);

  const query = useQuery<RssReport>({
    queryKey,
    queryFn: () =>
      apiFetch<RssReport>('/api/rss-reports', {
        method: 'POST',
        body: JSON.stringify({ feedUrl, feedName, reportType, force: false }),
      }),
    staleTime: 23 * 60 * 60 * 1000,
    retry: false,
    refetchInterval: polling ? 3_000 : false,
    refetchIntervalInBackground: true,
  });

  // Track the createdAt of the report that was current when refresh was triggered
  const [refreshedAfter, setRefreshedAfter] = useState<string | null>(null);

  // Stop polling once a report newer than when we triggered the refresh appears
  const currentCreatedAt = query.data?.createdAt;
  if (polling && refreshedAfter && currentCreatedAt && currentCreatedAt > refreshedAfter) {
    setPolling(false);
    setRefreshedAfter(null);
  }

  const forceRefresh = useMutation<void, Error>({
    mutationFn: () =>
      apiFetch<void>('/api/rss-reports', {
        method: 'POST',
        body: JSON.stringify({ feedUrl, feedName, reportType, force: true }),
      }),
    onSuccess: () => {
      // Backend returns 202 immediately; start polling for the new report
      setRefreshedAfter(query.data?.createdAt ?? new Date(0).toISOString());
      setPolling(true);
      void qc.invalidateQueries({ queryKey });
    },
  });

  return { query, forceRefresh, isRefreshing: polling || forceRefresh.isPending };
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
