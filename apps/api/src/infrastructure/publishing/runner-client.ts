import { config } from '../../config';

export interface RunnerJobRequest {
  platform: string;
  type: 'video' | 'note';
  uploadJobId: string;
  payload: {
    storageState: object;
    contentType: 'video' | 'note';
    title: string;
    description: string;
    tags: string[];
    videoPath?: string;
    imagePaths?: string[];
    thumbnailPath?: string;
    scheduledAt?: string;
    locale?: string;
    productLink?: string;
    productTitle?: string;
  };
  callbackUrl?: string;
}

export interface RunnerJobResponse {
  runnerJobId: string;
}

export interface RunnerJobSnapshot {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  progress: { step: string; percent?: number; message?: string } | null;
  result?: {
    postUrl?: string;
    postId?: string;
    finalStorageState?: object;
    failureReason?: string;
    logExcerpt: string;
  };
}

export interface RunnerValidateRequest {
  platform: string;
  storageState: object;
}

export interface RunnerValidateResponse {
  valid: boolean;
  reason?: string;
  finalStorageState?: object;
}

export class RunnerClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'RunnerClientError';
  }
}

function authHeader(): Record<string, string> {
  if (!config.RUNNER_TOKEN) {
    throw new Error('RUNNER_TOKEN is not configured');
  }
  return { Authorization: `Bearer ${config.RUNNER_TOKEN}` };
}

async function rpc<TRes>(method: string, path: string, body?: unknown): Promise<TRes> {
  const url = new URL(path, config.RUNNER_URL).toString();
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new RunnerClientError(
      `Runner ${method} ${path} failed: ${res.status} ${detail}`,
      res.status,
    );
  }
  return (await res.json()) as TRes;
}

export const runnerClient = {
  startJob: (req: RunnerJobRequest) => rpc<RunnerJobResponse>('POST', '/jobs', req),
  getJob: (runnerJobId: string) => rpc<RunnerJobSnapshot>('GET', `/jobs/${runnerJobId}`),
  cancelJob: (runnerJobId: string) => rpc<{ ok: true }>('POST', `/jobs/${runnerJobId}/cancel`),
  validate: (req: RunnerValidateRequest) =>
    rpc<RunnerValidateResponse>('POST', '/validate', req),
  health: () => rpc<{ status: 'ok'; activeJobs: number; maxBrowsers: number }>('GET', '/health'),
};
