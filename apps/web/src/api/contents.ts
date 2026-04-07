import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, QUEUED_OFFLINE } from './client.js';
import { toast } from '../store/toast.store.js';
import type { Content } from '@contentflow/shared';

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
      if ((data as unknown) !== QUEUED_OFFLINE) {
        toast.success('Content created');
      }
    },
    onError: (err) => {
      toast.error(`Failed to create content: ${err.message}`);
    },
  });
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation<Content, ApiError, { id: string; workspaceId: string; data: Record<string, unknown> }>({
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
        toast.success(`Stage updated to ${String(vars.data['stage'])}`);
      }
    },
    onError: (err, _vars, ctx) => {
      const context = ctx as { prev?: [unknown, Content[] | undefined][] } | undefined;
      if (context?.prev) {
        for (const [queryKey, data] of context.prev) {
          qc.setQueryData(queryKey as Parameters<typeof qc.setQueryData>[0], data);
        }
      }
      toast.error(`Failed to update content: ${err.message}`);
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: ['contents', vars.workspaceId] });
    },
  });
}
