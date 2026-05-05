import { EventEmitter } from 'node:events';
import type { ProgressEvent, PublishResult } from '../adapters/base.js';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface JobRecord {
  id: string;
  status: JobStatus;
  progress: ProgressEvent | null;
  result?: {
    postUrl?: string;
    postId?: string;
    failureReason?: string;
    logExcerpt: string;
    finalStorageState?: object;
  };
  cancelRequested: boolean;
  events: EventEmitter;
}

class JobStore {
  private jobs = new Map<string, JobRecord>();

  create(id: string): JobRecord {
    const rec: JobRecord = {
      id,
      status: 'queued',
      progress: null,
      cancelRequested: false,
      events: new EventEmitter(),
    };
    this.jobs.set(id, rec);
    return rec;
  }

  get(id: string): JobRecord | null {
    return this.jobs.get(id) ?? null;
  }

  setStatus(id: string, status: JobStatus): void {
    const r = this.jobs.get(id);
    if (!r) return;
    r.status = status;
    r.events.emit('status', status);
  }

  setProgress(id: string, p: ProgressEvent): void {
    const r = this.jobs.get(id);
    if (!r) return;
    r.progress = p;
    r.events.emit('progress', p);
  }

  finalize(id: string, status: 'succeeded' | 'failed' | 'canceled', result: PublishResult | { failureReason: string; logExcerpt: string }): void {
    const r = this.jobs.get(id);
    if (!r) return;
    r.status = status;
    r.result = {
      logExcerpt: result.logExcerpt,
      ...(('finalStorageState' in result) && (result as PublishResult).finalStorageState
        ? { finalStorageState: (result as PublishResult).finalStorageState }
        : {}),
      ...(('postUrl' in result) && (result as PublishResult).postUrl !== undefined
        ? { postUrl: (result as PublishResult).postUrl }
        : {}),
      ...(('postId' in result) && (result as PublishResult).postId !== undefined
        ? { postId: (result as PublishResult).postId }
        : {}),
      ...(('failureReason' in result) && result.failureReason !== undefined
        ? { failureReason: result.failureReason }
        : {}),
    };
    r.events.emit('done', { status, result: r.result });
  }

  requestCancel(id: string): boolean {
    const r = this.jobs.get(id);
    if (!r) return false;
    if (['succeeded', 'failed', 'canceled'].includes(r.status)) return false;
    r.cancelRequested = true;
    r.events.emit('cancel');
    return true;
  }
}

export const jobStore = new JobStore();
