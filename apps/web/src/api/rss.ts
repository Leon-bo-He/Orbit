import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface RssArticle {
  title: string;
  link: string;
  pubDate: string;
}

export interface RssFeedPage {
  articles: RssArticle[];
  total: number;
  page: number;
  pages: number;
}

export function useDeleteRssFeed() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (url) =>
      apiFetch<void>(`/api/rss?url=${encodeURIComponent(url)}`, { method: 'DELETE' }),
    onSuccess: (_data, url) => {
      qc.removeQueries({ queryKey: ['rss', url] });
      qc.removeQueries({ queryKey: ['rss-report', url] });
      qc.removeQueries({ queryKey: ['rss-report-check', url] });
    },
  });
}

export function useRssFeed(url: string, page: number, pageSize: number) {
  return useQuery<RssFeedPage>({
    queryKey: ['rss', url, page, pageSize],
    queryFn: () =>
      apiFetch<RssFeedPage>(`/api/rss?url=${encodeURIComponent(url)}&page=${page}&pageSize=${pageSize}`),
    enabled: pageSize > 0,
    staleTime: 15 * 60 * 1000,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}
