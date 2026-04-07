import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@contentflow/shared';
import { useUpdatePublication } from '../../api/publications.js';

interface PlatformConfigFormProps {
  publication: Publication;
  onClose: () => void;
}

function toDatetimeLocal(val: Date | string | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlatformConfigForm({ publication, onClose }: PlatformConfigFormProps) {
  const { t } = useTranslation('publications');
  const updatePublication = useUpdatePublication();

  const [platformTitle, setPlatformTitle] = useState(publication.platformTitle ?? '');
  const [platformCopy, setPlatformCopy] = useState(publication.platformCopy ?? '');
  const [tags, setTags] = useState<string[]>(publication.platformTags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(publication.scheduledAt));
  const [visibility, setVisibility] = useState<'public' | 'private' | 'friends'>(
    (publication.platformSettings?.visibility as 'public' | 'private' | 'friends') ?? 'public',
  );
  const [allowComments, setAllowComments] = useState(
    publication.platformSettings?.allowComments ?? true,
  );

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSave() {
    await updatePublication.mutateAsync({
      id: publication.id,
      contentId: publication.contentId,
      data: {
        platformTitle: platformTitle || null,
        platformCopy: platformCopy || null,
        platformTags: tags,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        platformSettings: { visibility, allowComments },
      },
    });
    onClose();
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
      {/* Platform title */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('config.platform_title')}
        </label>
        <input
          value={platformTitle}
          onChange={(e) => setPlatformTitle(e.target.value)}
          placeholder={t('config.platform_title_hint')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Platform copy */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('config.platform_copy')}
        </label>
        <textarea
          value={platformCopy}
          onChange={(e) => setPlatformCopy(e.target.value)}
          rows={3}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Hashtags */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('config.hashtags')}
        </label>
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-0.5 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-indigo-400 hover:text-indigo-700 ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={t('config.hashtag_placeholder')}
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <button
            type="button"
            onClick={addTag}
            className="text-xs bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
          >
            +
          </button>
        </div>
      </div>

      {/* Scheduled at */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('config.scheduled_at')}
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Visibility + allow comments */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('config.visibility')}
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'private' | 'friends')}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="public">{t('config.visibility_public')}</option>
            <option value="private">{t('config.visibility_private')}</option>
            <option value="friends">{t('config.visibility_friends')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input
            id="allow-comments"
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="allow-comments" className="text-xs text-gray-600">
            {t('config.allow_comments')}
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
        >
          {t('config.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={updatePublication.isPending}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {updatePublication.isPending ? '...' : t('config.save')}
        </button>
      </div>
    </div>
  );
}
