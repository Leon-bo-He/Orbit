import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';
import { toast } from '../store/toast.store.js';
import i18n from '../i18n/index.js';
import type { Publication } from '@contentflow/shared';

export interface QueueItem {
  publication: Publication;
  content: { id: string; title: string };
  workspace: { id: string; name: string; color: string; icon: string };
}

export interface PublishQueueFilters {
  status?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

// GET /api/contents/:id/publications
export function usePublications(contentId: string) {
  return useQuery<Publication[], ApiError>({
    queryKey: ['publications', contentId],
    queryFn: () => apiFetch<Publication[]>(`/api/contents/${contentId}/publications`),
    enabled: Boolean(contentId),
  });
}

// POST /api/contents/:id/publications
export function useCreatePublication(contentId: string) {
  const qc = useQueryClient();
  return useMutation<Publication, ApiError, Record<string, unknown>>({
    mutationFn: (body) =>
      apiFetch<Publication>(`/api/contents/${contentId}/publications`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['publications', contentId] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('toast_platform_added', { ns: 'publications' }));
    },
    onError: (err) => {
      toast.error(i18n.t('toast_platform_add_failed', { ns: 'publications', message: err.message }));
    },
  });
}

// PATCH /api/publications/:id
export function useUpdatePublication() {
  const qc = useQueryClient();
  return useMutation<Publication, ApiError, { id: string; contentId: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      apiFetch<Publication>(`/api/publications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['publications', vars.contentId] });
      void qc.invalidateQueries({ queryKey: ['publishQueue'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(i18n.t('toast_update_failed', { ns: 'publications', message: err.message }));
    },
  });
}

// POST /api/publications/:id/mark-published
export function useMarkPublished() {
  const qc = useQueryClient();
  return useMutation<
    Publication,
    ApiError,
    { id: string; contentId: string; data: { platformUrl: string; platformPostId?: string; publishedAt?: string } }
  >({
    mutationFn: ({ id, data }) =>
      apiFetch<Publication>(`/api/publications/${id}/mark-published`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['publications', vars.contentId] });
      void qc.invalidateQueries({ queryKey: ['publishQueue'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('toast_marked_published', { ns: 'publications' }));
    },
    onError: (err) => {
      toast.error(i18n.t('toast_mark_published_failed', { ns: 'publications', message: err.message }));
    },
  });
}

// GET /api/publications/queue
export function usePublishQueue(filters?: PublishQueueFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const qs = params.toString();

  return useQuery<QueueItem[], ApiError>({
    queryKey: ['publishQueue', filters],
    queryFn: () => apiFetch<QueueItem[]>(`/api/publications/queue${qs ? `?${qs}` : ''}`),
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}

// DELETE /api/publications/:id
export function useDeletePublication() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; contentId: string }>({
    mutationFn: ({ id }) =>
      apiFetch<void>(`/api/publications/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['publications', vars.contentId] });
      void qc.invalidateQueries({ queryKey: ['publishQueue'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(i18n.t('toast_update_failed', { ns: 'publications', message: err.message }));
    },
  });
}

// PATCH /api/publications/batch
export function useBatchUpdatePublications() {
  const qc = useQueryClient();
  return useMutation<{ updated: number }, ApiError, { ids: string[]; scheduledAt?: string; status?: string }>({
    mutationFn: (body) =>
      apiFetch<{ updated: number }>('/api/publications/batch', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['publishQueue'] });
      void qc.invalidateQueries({ queryKey: ['publications'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
