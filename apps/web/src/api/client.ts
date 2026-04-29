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
let onTokenRefreshed: ((token: string) => void) | null = null;

// Serialize concurrent refresh attempts so only one request fires at a time.
let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch('/api/auth/refresh', { method: 'POST' })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = await r.json() as { accessToken: string };
      setAccessToken(data.accessToken);
      onTokenRefreshed?.(data.accessToken);
      return data.accessToken;
    })
    .catch(() => null)
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Register a callback invoked when any non-auth API call returns 401 after refresh also fails. */
export function registerUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

/** Register a callback invoked when a silent token refresh succeeds (to persist new token). */
export function registerTokenRefreshedHandler(fn: (token: string) => void) {
  onTokenRefreshed = fn;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => ({
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers: buildHeaders(accessToken) });
  } catch (networkErr) {
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

  // On 401 for non-auth routes: try a silent token refresh then retry once.
  if (res.status === 401 && !path.startsWith('/api/auth')) {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      // Retry original request with fresh token
      const retryRes = await fetch(path, { ...options, headers: buildHeaders(newToken) });
      if (retryRes.ok) {
        if (retryRes.status === 204) return undefined as unknown as T;
        return retryRes.json() as Promise<T>;
      }
      if (retryRes.status === 401) {
        onUnauthorized?.();
        const body = await retryRes.json().catch(() => ({ error: retryRes.statusText }));
        throw new ApiError(401, (body as { error: string }).error ?? retryRes.statusText);
      }
      const body = await retryRes.json().catch(() => ({ error: retryRes.statusText }));
      throw new ApiError(retryRes.status, (body as { error: string }).error ?? retryRes.statusText);
    }
    // Refresh failed — session is truly expired
    onUnauthorized?.();
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(401, (body as { error: string }).error ?? res.statusText);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as { error: string }).error ?? res.statusText);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
