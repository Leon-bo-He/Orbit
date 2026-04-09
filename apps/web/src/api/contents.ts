import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiFetch, ApiError, QUEUED_OFFLINE } from './client.js';
import { toast } from '../store/toast.store.js';
import i18n from '../i18n/index.js';
import type { Content, Idea } from '@contentflow/shared';

export interface ContentFilters {
  stage?: string;
}

function buildContentsQuery(workspaceId: string, filters?: ContentFilters): string {
  const params = new URLSearchParams({ workspace: workspaceId });
  if (filters?.stage) params.set('stage', filters.stage);
  return `/api/contents?${params.toString()}`;
}

export function useContents(workspaceId: string, filters?: ContentFilters) {
  return useQuery<Content[], ApiError>({
    queryKey: ['contents', workspaceId, filters],
    queryFn: () => apiFetch<Content[]>(buildContentsQuery(workspaceId, filters)),
    enabled: Boolean(workspaceId),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 3;
    },
  });
}

export function useCreateContent() {
  const qc = useQueryClient();
  return useMutation<Content, ApiError, Record<string, unknown>>({
    mutationFn: (body) =>
      apiFetch<Content>('/api/contents', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data, variables) => {
      void qc.invalidateQueries({ queryKey: ['contents', variables['workspaceId']] });
      void qc.invalidateQueries({ queryKey: ['calendarContents', variables['workspaceId']] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      if ((data as unknown) !== QUEUED_OFFLINE) {
        toast.success(i18n.t('toast_created', { ns: 'contents' }));
      }
    },
    onError: (err) => {
      toast.error(i18n.t('create_error', { ns: 'contents', message: err.message }));
    },
  });
}

export function useDeleteContent() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; workspaceId: string }>({
    mutationFn: ({ id }) =>
      apiFetch<void>(`/api/contents/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['contents', vars.workspaceId] });
      void qc.invalidateQueries({ queryKey: ['calendarContents', vars.workspaceId] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('toast_deleted', { ns: 'contents' }));
    },
    onError: (err) => {
      toast.error(i18n.t('delete_error', { ns: 'contents', message: err.message }));
    },
  });
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation<Content, ApiError, { id: string; workspaceId: string; data: Record<string, unknown>; silent?: boolean }>({
    mutationFn: ({ id, data }) =>
      apiFetch<Content>(`/api/contents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onMutate: async ({ id, workspaceId, data }) => {
      await qc.cancelQueries({ queryKey: ['contents', workspaceId] });
      const prev = qc.getQueriesData<Content[]>({ queryKey: ['contents', workspaceId] });
      qc.setQueriesData<Content[]>({ queryKey: ['contents', workspaceId] }, (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...data } as Content : c))
      );
      return { prev };
    },
    onSuccess: (_data, vars) => {
      if (vars.data['stage']) {
        if (!vars.silent) {
          const stage = String(vars.data['stage']);
          const stageName = i18n.t(`stages.${stage}`, { ns: 'contents' });
          toast.success(i18n.t('stage_updated', { ns: 'contents', stage: stageName }));
        }
        void qc.invalidateQueries({ queryKey: ['ideas'] });
      }
    },
    onError: (err, _vars, ctx) => {
      const context = ctx as { prev?: [unknown, Content[] | undefined][] } | undefined;
      if (context?.prev) {
        for (const [queryKey, data] of context.prev) {
          qc.setQueryData(queryKey as Parameters<typeof qc.setQueryData>[0], data);
        }
      }
      toast.error(i18n.t('update_error', { ns: 'contents', message: err.message }));
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: ['contents', vars.workspaceId] });
      void qc.invalidateQueries({ queryKey: ['calendarContents', vars.workspaceId] });
      void qc.invalidateQueries({ queryKey: ['contentCount'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
