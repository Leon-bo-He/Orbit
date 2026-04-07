import { useTranslation } from 'react-i18next';
import type { ContentPlan, ContentType } from '@contentflow/shared';

interface FormatSectionProps {
  contentType: ContentType;
  plan: Partial<ContentPlan>;
  onChange: (patch: Partial<ContentPlan>) => void;
}

const ASPECT_RATIOS = [
  { value: '9:16', label: '9:16 竖屏' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '1:1', label: '1:1 方形' },
  { value: '4:3', label: '4:3' },
];

const VIDEO_TYPES: ContentType[] = ['video_short', 'video_long'];
const VIDEO_PODCAST_TYPES: ContentType[] = ['video_short', 'video_long', 'podcast'];

export function FormatSection({ contentType, plan, onChange }: FormatSectionProps) {
  const { t } = useTranslation('contents');
  const formatConfig = plan.formatConfig ?? {};
  const isVideoOrPodcast = VIDEO_PODCAST_TYPES.includes(contentType);
  const isVideo = VIDEO_TYPES.includes(contentType);

  function patchFormat(patch: Record<string, unknown>) {
    onChange({ formatConfig: { ...formatConfig, ...patch } });
  }

  return (
    <div className="space-y-4">
      {/* Read-only content type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('drawer.content_type_label')}
        </label>
        <span className="text-sm text-gray-700">
          {t(`content_types.${contentType}`)}
        </span>
      </div>

      {/* Duration — video/podcast only */}
      {isVideoOrPodcast && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('brief.format.duration_label')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={typeof formatConfig['duration'] === 'number' ? formatConfig['duration'] : ''}
              onChange={(e) =>
                patchFormat({ duration: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="60"
              className="w-28 text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="text-xs text-gray-400">{t('brief.format.duration_unit')}</span>
          </div>
        </div>
      )}

      {/* Aspect ratio — video only */}
      {isVideo && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('brief.format.aspect_ratio_label')}
          </label>
          <select
            value={typeof formatConfig['aspectRatio'] === 'string' ? formatConfig['aspectRatio'] : ''}
            onChange={(e) => patchFormat({ aspectRatio: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">{t('brief.format.aspect_ratio_placeholder')}</option>
            {ASPECT_RATIOS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Format notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.format.notes_label')}
        </label>
        <textarea
          value={typeof formatConfig['notes'] === 'string' ? formatConfig['notes'] : ''}
          onChange={(e) => patchFormat({ notes: e.target.value })}
          rows={3}
          placeholder={t('brief.format.notes_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>
    </div>
  );
}
