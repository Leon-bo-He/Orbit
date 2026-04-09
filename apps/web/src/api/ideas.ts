import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiFetch, ApiError, QUEUED_OFFLINE } from './client.js';
import { toast } from '../store/toast.store.js';
import i18n from '../i18n/index.js';
import type { Idea } from '@contentflow/shared';

export interface IdeaFilters {
  workspace?: string;
  status?: string;
  tag?: string;
  priority?: string;
  q?: string;
}

export interface ConvertIdeaInput {
  workspaceId: string;
  title?: string;
  contentType?: string;
}

export interface ConvertIdeaResult {
  idea: Idea;
  content: unknown;
}

function buildQuery(filters: IdeaFilters): string {
  const params = new URLSearchParams();
  if (filters.workspace) params.set('workspace', filters.workspace);
  if (filters.status) params.set('status', filters.status);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.q) params.set('q', filters.q);
  const qs = params.toString();
  return qs ? `/api/ideas?${qs}` : '/api/ideas';
}

export function useIdeas(filters: IdeaFilters = {}) {
  return useQuery<Idea[], ApiError>({
    queryKey: ['ideas', filters],
    queryFn: () => apiFetch<Idea[]>(buildQuery(filters)),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 3;
    },
  });
}

export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation<Idea, ApiError, Record<string, unknown>>({
    mutationFn: (body) =>
      apiFetch<Idea>('/api/ideas', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['ideas'] });
      if ((data as unknown) !== QUEUED_OFFLINE) {
        toast.success(i18n.t('toast_created', { ns: 'ideas' }));
      }
    },
    onError: (err) => {
      toast.error(i18n.t('toast_create_failed', { ns: 'ideas', message: err.message }));
    },
  });
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation<Idea, ApiError, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      apiFetch<Idea>(`/api/ideas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['ideas'] });
      const prev = qc.getQueriesData<Idea[]>({ queryKey: ['ideas'] });
      qc.setQueriesData<Idea[]>({ queryKey: ['ideas'] }, (old) =>
        old?.map((idea) => (idea.id === id ? { ...idea, ...data } as Idea : idea))
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success(i18n.t('toast_saved', { ns: 'ideas' }));
    },
    onError: (err, _vars, ctx) => {
      const context = ctx as { prev?: [unknown, Idea[] | undefined][] } | undefined;
      if (context?.prev) {
        for (const [queryKey, data] of context.prev) {
          qc.setQueryData(queryKey as Parameters<typeof qc.setQueryData>[0], data);
        }
      }
      toast.error(i18n.t('toast_update_failed', { ns: 'ideas', message: err.message }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['ideas'] });
    },
  });
}

export function useConvertIdea() {
  const qc = useQueryClient();
  return useMutation<ConvertIdeaResult, ApiError, { id: string; data: ConvertIdeaInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<ConvertIdeaResult>(`/api/ideas/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['ideas'] });
      void qc.invalidateQueries({ queryKey: ['contents', variables.data.workspaceId] });
      void qc.invalidateQueries({ queryKey: ['calendarContents', variables.data.workspaceId] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
