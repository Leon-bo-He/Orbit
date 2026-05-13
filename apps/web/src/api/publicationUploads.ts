import { useMutation } from '@tanstack/react-query';
import { ApiError, getAccessToken } from './client.js';

export interface UploadedFile {
  url: string;
  path: string;
  size?: number;
}

async function postMultipart<T>(url: string, files: File[], field = 'file'): Promise<T> {
  const form = new FormData();
  for (const f of files) form.append(field, f);
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', body: form, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useUploadPublicationVideo() {
  return useMutation<UploadedFile, ApiError, File>({
    mutationFn: (file) => postMultipart<UploadedFile>('/api/upload/video', [file]),
  });
}

export function useUploadPublicationThumbnail() {
  return useMutation<UploadedFile, ApiError, File>({
    mutationFn: (file) => postMultipart<UploadedFile>('/api/upload/thumbnail', [file]),
  });
}

export function useUploadPublicationNoteImages() {
  return useMutation<{ files: UploadedFile[] }, ApiError, File[]>({
    mutationFn: (files) => postMultipart<{ files: UploadedFile[] }>('/api/upload/note-images', files, 'file'),
  });
}
