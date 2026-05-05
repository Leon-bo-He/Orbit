import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUploadJob, useCancelUploadJob, useRetryUploadJob, type UploadJob } from '../../api/uploadJobs.js';
import { toast } from '../../store/toast.store.js';

interface ProgressEvent {
  step: string;
  percent?: number;
  message?: string;
}

interface Props {
  jobId: string;
  onClose: () => void;
}

export function UploadJobDrawer({ jobId, onClose }: Props) {
  const { t } = useTranslation('publications');
  const jobQ = useUploadJob(jobId);
  const cancel = useCancelUploadJob();
  const retry = useRetryUploadJob();
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [streamError, setStreamError] = useState<string>('');

  useEffect(() => {
    const url = `/api/upload-jobs/${jobId}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.addEventListener('progress', (ev) => {
      try {
        setProgress(JSON.parse((ev as MessageEvent).data));
      } catch { /* ignore */ }
    });
    const closeOn = (label: string) => () => {
      es.close();
      if (label === 'failed' || label === 'canceled') setStreamError(label);
    };
    es.addEventListener('succeeded', closeOn('succeeded'));
    es.addEventListener('failed', closeOn('failed'));
    es.addEventListener('canceled', closeOn('canceled'));
    es.onerror = () => {
      setStreamError('disconnected');
      es.close();
    };
    return () => es.close();
  }, [jobId]);

  const job: UploadJob | undefined = jobQ.data;
  const status = job?.status ?? 'queued';
  const percent = progress?.percent ?? (status === 'succeeded' ? 100 : 0);

  async function handleCancel() {
    try {
      await cancel.mutateAsync(jobId);
      toast.info(t('job_drawer.canceled'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRetry() {
    if (!job) return;
    try {
      const newJob = await retry.mutateAsync(jobId);
      toast.success(t('job_drawer.retried'));
      // Note: caller is responsible for switching to the new job id if desired.
      void newJob;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-[420px] max-w-full bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('job_drawer.title')}</h3>
            <p className="text-[11px] text-gray-500 font-mono">{jobId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium uppercase text-gray-500">{t('job_drawer.status')}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(status)}`}>
                {t(`job_drawer.status_${status}`)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            {progress?.step && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {t('job_drawer.step')}: <span className="font-mono">{progress.step}</span>
                {progress.message ? ` — ${progress.message}` : ''}
              </p>
            )}
          </div>

          {job?.resultUrl && (
            <div>
              <span className="text-xs font-medium uppercase text-gray-500 block mb-1">{t('job_drawer.url')}</span>
              <a
                href={job.resultUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-600 hover:underline break-all"
              >
                {job.resultUrl}
              </a>
            </div>
          )}

          {job?.failureReason && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2">
              <span className="text-xs font-medium uppercase text-red-700 dark:text-red-300 block mb-1">
                {t('job_drawer.failure')}
              </span>
              <p className="text-sm text-red-700 dark:text-red-300">{job.failureReason}</p>
            </div>
          )}

          {job?.logExcerpt && (
            <details className="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                {t('job_drawer.log')}
              </summary>
              <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap text-gray-600 dark:text-gray-300 max-h-64 overflow-y-auto">
{job.logExcerpt}
              </pre>
            </details>
          )}

          {streamError === 'disconnected' && (
            <p className="text-xs text-amber-600">{t('job_drawer.stream_disconnected')}</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          {(status === 'queued' || status === 'running') && (
            <button
              onClick={() => void handleCancel()}
              className="px-3 py-1.5 text-xs rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              {t('job_drawer.cancel')}
            </button>
          )}
          {status === 'failed' && (
            <button
              onClick={() => void handleRetry()}
              className="px-3 py-1.5 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700"
            >
              {t('job_drawer.retry')}
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            {t('job_drawer.close')}
          </button>
        </div>
      </aside>
    </div>
  );
}

function statusBadge(status: string): string {
  switch (status) {
    case 'queued':    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    case 'running':   return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
    case 'succeeded': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200';
    case 'failed':    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200';
    case 'canceled':  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
    default:          return 'bg-gray-100 text-gray-700';
  }
}
