import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';

export type UploadJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface UploadJob {
  id: string;
  publicationId: string;
  platformAccountId: string | null;
  status: UploadJobStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempt: number;
  bullmqJobId: string | null;
  runnerJobId: string | null;
  resultUrl: string | null;
  resultPostId: string | null;
  failureReason: string | null;
  logExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useUploadJob(jobId: string | null) {
  return useQuery<UploadJob, ApiError>({
    queryKey: ['uploadJob', jobId],
    queryFn: () => apiFetch<UploadJob>(`/api/upload-jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'queued' || status === 'running' ? 2_000 : false;
    },
  });
}

export function usePublicationJobs(publicationId: string | null) {
  return useQuery<UploadJob[], ApiError>({
    queryKey: ['uploadJobs', 'byPublication', publicationId],
    queryFn: () => apiFetch<UploadJob[]>(`/api/publications/${publicationId}/jobs`),
    enabled: Boolean(publicationId),
  });
}

export function usePublishNow() {
  const qc = useQueryClient();
  return useMutation<
    { jobId: string; status: UploadJobStatus },
    ApiError,
    { publicationId: string; platformAccountId: string; scheduledAt?: string }
  >({
    mutationFn: ({ publicationId, ...body }) =>
      apiFetch<{ jobId: string; status: UploadJobStatus }>(
        `/api/publications/${publicationId}/publish`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['publications', vars.publicationId] });
      void qc.invalidateQueries({ queryKey: ['uploadJobs', 'byPublication', vars.publicationId] });
      void qc.invalidateQueries({ queryKey: ['publishQueue'] });
    },
  });
}

export function useCancelUploadJob() {
  const qc = useQueryClient();
  return useMutation<UploadJob, ApiError, string>({
    mutationFn: (id) => apiFetch<UploadJob>(`/api/upload-jobs/${id}/cancel`, { method: 'POST' }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['uploadJob', data.id] });
      void qc.invalidateQueries({ queryKey: ['uploadJobs', 'byPublication', data.publicationId] });
    },
  });
}

export function useRetryUploadJob() {
  const qc = useQueryClient();
  return useMutation<UploadJob, ApiError, string>({
    mutationFn: (id) => apiFetch<UploadJob>(`/api/upload-jobs/${id}/retry`, { method: 'POST' }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['uploadJob', data.id] });
      void qc.invalidateQueries({ queryKey: ['uploadJobs', 'byPublication', data.publicationId] });
    },
  });
}
