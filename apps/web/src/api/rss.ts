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
    },
  });
}

export function useRssFeed(url: string, page: number) {
  return useQuery<RssFeedPage>({
    queryKey: ['rss', url, page],
    queryFn: () =>
      apiFetch<RssFeedPage>(`/api/rss?url=${encodeURIComponent(url)}&page=${page}`),
    staleTime: 15 * 60 * 1000,
    placeholderData: (prev) => prev, // keep previous page visible while loading next
    retry: 1,
  });
}
