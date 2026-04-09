import { useOfflineQueue } from '../store/offline-queue.store.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const QUEUED_OFFLINE = Symbol('QUEUED_OFFLINE');

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Register a callback invoked when any non-auth API call returns 401. */
export function registerUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch (networkErr) {
    // Network failure — enqueue mutations, reject GETs and auth routes
    const method = (options.method ?? 'GET').toUpperCase();
    const isAuthRoute = path.startsWith('/api/auth');
    if (!isAuthRoute && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
      let body: unknown;
      try {
        body = options.body ? JSON.parse(options.body as string) : undefined;
      } catch {
        body = options.body;
      }
      useOfflineQueue.getState().enqueue({
        id: crypto.randomUUID(),
        method: method as 'POST' | 'PATCH' | 'DELETE',
        url: path,
        body,
      });
      return QUEUED_OFFLINE as unknown as T;
    }
    throw networkErr;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, (body as { error: string }).error ?? res.statusText);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
