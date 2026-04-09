import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';

export interface CustomPlatform {
  id: string;
  name: string;
  icon: string;
}

export function useCustomPlatforms() {
  return useQuery<CustomPlatform[], ApiError>({
    queryKey: ['custom-platforms'],
    queryFn: () => apiFetch<CustomPlatform[]>('/api/custom-platforms'),
  });
}

export function useCreateCustomPlatform() {
  const qc = useQueryClient();
  return useMutation<CustomPlatform, ApiError, { name: string; icon: string }>({
    mutationFn: (body) =>
      apiFetch<CustomPlatform>('/api/custom-platforms', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['custom-platforms'] }),
  });
}

export function useDeleteCustomPlatform() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => apiFetch<void>(`/api/custom-platforms/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['custom-platforms'] }),
  });
}
