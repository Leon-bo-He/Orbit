import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, getAccessToken } from './client.js';
import type { Workspace } from '@orbit/shared';

export function useWorkspaces() {
  return useQuery<Workspace[], ApiError>({
    queryKey: ['workspaces'],
    queryFn: () => apiFetch<Workspace[]>('/api/workspaces'),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 3;
    },
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation<Workspace, ApiError, Record<string, unknown>>({
    mutationFn: (body) =>
      apiFetch<Workspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation<Workspace, ApiError, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      apiFetch<Workspace>(`/api/workspaces/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUploadWorkspaceIcon() {
  return useMutation<{ url: string }, ApiError, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      // Do NOT use apiFetch here — it would add Content-Type: application/json
      // and clobber the multipart/form-data boundary set by the browser.
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/upload/workspace-icon', { method: 'POST', body: form, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(res.status, (body as { error: string }).error ?? res.statusText);
      }
      return res.json() as Promise<{ url: string }>;
    },
  });
}
