import { useTranslation } from 'react-i18next';
import { usePublicationJobs, type UploadJob } from '../../api/uploadJobs.js';

interface Props {
  publicationId: string;
  onClick: (jobId: string) => void;
}

export function UploadJobBadge({ publicationId, onClick }: Props) {
  const { t } = useTranslation('publications');
  const { data: jobs = [] } = usePublicationJobs(publicationId);
  const latest = pickActiveOrLatest(jobs);
  if (!latest) return null;

  const label = t(`job_badge.${latest.status}`);
  return (
    <button
      onClick={() => onClick(latest.id)}
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge(latest.status)}`}
      title={label}
      type="button"
    >
      {label}
    </button>
  );
}

function pickActiveOrLatest(jobs: UploadJob[]): UploadJob | null {
  const active = jobs.find((j) => j.status === 'running' || j.status === 'queued');
  return active ?? jobs[0] ?? null;
}

function badge(status: string): string {
  switch (status) {
    case 'queued':    return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    case 'running':   return 'bg-blue-100 text-blue-700 hover:bg-blue-200 animate-pulse';
    case 'succeeded': return 'bg-green-100 text-green-700 hover:bg-green-200';
    case 'failed':    return 'bg-red-100 text-red-700 hover:bg-red-200';
    case 'canceled':  return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
    default:          return 'bg-gray-100 text-gray-600';
  }
}
