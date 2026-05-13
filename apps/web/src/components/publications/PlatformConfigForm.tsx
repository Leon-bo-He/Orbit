import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@orbit/shared';
import { useUpdatePublication } from '../../api/publications.js';
import {
  useUploadPublicationVideo,
  useUploadPublicationThumbnail,
  useUploadPublicationNoteImages,
} from '../../api/publicationUploads.js';
import { DateTimePicker } from '../ui/DateTimePicker.js';
import { useUiStore, type PublicationTemplate } from '../../store/ui.store.js';
import { toast } from '../../store/toast.store.js';

type MediaKind = 'video' | 'note';

interface MediaSettings {
  mediaKind?: MediaKind;
  videoUrl?: string;
  videoPath?: string;
  videoName?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  imageUrls?: string[];
  imagePaths?: string[];
}

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

// ─── Template Picker Popover ──────────────────────────────────────────────────

function TemplatePicker({
  onApply,
  onClose,
}: {
  onApply: (tpl: PublicationTemplate) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('publications');
  const { publicationTemplates, removePublicationTemplate } = useUiStore();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const confirmTarget = deleteConfirmId ? publicationTemplates.find((t) => t.id === deleteConfirmId) : null;

  if (publicationTemplates.length === 0) {
    return (
      <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
        <p className="text-xs text-gray-400 text-center">{t('template.empty')}</p>
        <p className="text-xs text-gray-400 text-center mt-1">{t('template.empty_hint')}</p>
        <button onClick={onClose} className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700">
          {t('config.cancel')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-600">{t('template.pick')}</p>
        </div>
        <ul className="max-h-48 overflow-y-auto">
          {publicationTemplates.map((tpl) => (
            <li key={tpl.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-sm font-medium text-gray-800 truncate">{tpl.name}</p>
                {tpl.platformCopy && (
                  <p className="text-xs text-gray-400 truncate">{tpl.platformCopy}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { onApply(tpl); onClose(); }}
                  className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  {t('template.apply')}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(tpl.id)}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                  title={t('template.delete')}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-72">
            <p className="text-sm font-semibold text-gray-900 mb-1">{t('template.delete_confirm_title')}</p>
            <p className="text-xs text-gray-500 mb-4">
              {t('template.delete_confirm_desc', { name: confirmTarget.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
              >
                {t('config.cancel')}
              </button>
              <button
                onClick={() => { removePublicationTemplate(confirmTarget.id); setDeleteConfirmId(null); }}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
              >
                {t('template.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Save Template Modal ──────────────────────────────────────────────────────

function SaveTemplateModal({
  onSave,
  onClose,
}: {
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('publications');
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('template.save_title')}</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); if (e.key === 'Escape') onClose(); }}
          placeholder={t('template.name_placeholder')}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
            {t('config.cancel')}
          </button>
          <button
            onClick={() => { if (name.trim()) onSave(name.trim()); }}
            disabled={!name.trim()}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-40"
          >
            {t('template.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function PlatformConfigForm({ publication, onClose }: PlatformConfigFormProps) {
  const { t } = useTranslation('publications');
  const updatePublication = useUpdatePublication();
  const { publicationTemplates, savePublicationTemplate } = useUiStore();

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

  const initialMedia: MediaSettings = (publication.platformSettings ?? {}) as MediaSettings;
  const [mediaKind, setMediaKind] = useState<MediaKind>(
    initialMedia.mediaKind ?? (initialMedia.imagePaths?.length ? 'note' : 'video'),
  );
  const [videoUrl, setVideoUrl] = useState<string | undefined>(initialMedia.videoUrl);
  const [videoPath, setVideoPath] = useState<string | undefined>(initialMedia.videoPath);
  const [videoName, setVideoName] = useState<string | undefined>(initialMedia.videoName);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(initialMedia.thumbnailUrl);
  const [thumbnailPath, setThumbnailPath] = useState<string | undefined>(initialMedia.thumbnailPath);
  const [imageUrls, setImageUrls] = useState<string[]>(initialMedia.imageUrls ?? []);
  const [imagePaths, setImagePaths] = useState<string[]>(initialMedia.imagePaths ?? []);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const uploadVideo = useUploadPublicationVideo();
  const uploadThumb = useUploadPublicationThumbnail();
  const uploadNote = useUploadPublicationNoteImages();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  function applyTemplate(tpl: PublicationTemplate) {
    if (tpl.platformTitle !== undefined) setPlatformTitle(tpl.platformTitle ?? '');
    if (tpl.platformCopy !== undefined) setPlatformCopy(tpl.platformCopy ?? '');
    if (tpl.platformTags !== undefined) setTags(tpl.platformTags ?? []);
    if (tpl.visibility !== undefined) setVisibility(tpl.visibility);
    if (tpl.allowComments !== undefined) setAllowComments(tpl.allowComments);
  }

  function handleSaveTemplate(name: string) {
    savePublicationTemplate({
      name,
      ...(platformTitle && { platformTitle }),
      ...(platformCopy && { platformCopy }),
      ...(tags.length && { platformTags: tags }),
      visibility,
      allowComments,
    });
    setSaveModalOpen(false);
  }

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await uploadVideo.mutateAsync(file);
      setVideoUrl(r.url);
      setVideoPath(r.path);
      setVideoName(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleThumbPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await uploadThumb.mutateAsync(file);
      setThumbnailUrl(r.url);
      setThumbnailPath(r.path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleNotePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (imageUrls.length + files.length > 9) {
      toast.error(t('config.media.too_many_images'));
      return;
    }
    try {
      const r = await uploadNote.mutateAsync(files);
      setImageUrls([...imageUrls, ...r.files.map((f) => f.url)]);
      setImagePaths([...imagePaths, ...r.files.map((f) => f.path)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function clearVideo() {
    setVideoUrl(undefined);
    setVideoPath(undefined);
    setVideoName(undefined);
  }

  function clearThumbnail() {
    setThumbnailUrl(undefined);
    setThumbnailPath(undefined);
  }

  function removeNoteImage(index: number) {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
    setImagePaths(imagePaths.filter((_, i) => i !== index));
  }

  async function handleSave() {
    // Preserve unrelated platformSettings keys (e.g. productLink/productTitle set elsewhere).
    const prevSettings = (publication.platformSettings ?? {}) as Record<string, unknown>;
    const media: MediaSettings =
      mediaKind === 'video'
        ? {
            mediaKind: 'video',
            ...(videoUrl ? { videoUrl } : {}),
            ...(videoPath ? { videoPath } : {}),
            ...(videoName ? { videoName } : {}),
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            ...(thumbnailPath ? { thumbnailPath } : {}),
          }
        : {
            mediaKind: 'note',
            imageUrls,
            imagePaths,
          };

    await updatePublication.mutateAsync({
      id: publication.id,
      contentId: publication.contentId,
      data: {
        platformTitle: platformTitle || null,
        platformCopy: platformCopy || null,
        platformTags: tags,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        platformSettings: {
          ...prevSettings,
          visibility,
          allowComments,
          ...media,
        },
      },
    });
    onClose();
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
      {/* Template bar */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">{t('config.title')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSaveModalOpen(true)}
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            {t('template.save_current')}
          </button>
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                publicationTemplates.length > 0
                  ? 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {t('template.use')} {publicationTemplates.length > 0 && `(${publicationTemplates.length})`}
            </button>
            {pickerOpen && (
              <TemplatePicker
                onApply={applyTemplate}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

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

      {/* Media (video + thumbnail, or note images) */}
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">{t('config.media.title')}</span>
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setMediaKind('video')}
              className={`px-2.5 py-1 ${mediaKind === 'video' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {t('config.media.kind_video')}
            </button>
            <button
              type="button"
              onClick={() => setMediaKind('note')}
              className={`px-2.5 py-1 border-l border-gray-200 ${mediaKind === 'note' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {t('config.media.kind_note')}
            </button>
          </div>
        </div>

        {mediaKind === 'video' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1">{t('config.media.video_label')}</p>
              {videoUrl ? (
                <div className="rounded border border-gray-200 overflow-hidden bg-gray-50">
                  <video src={videoUrl} controls className="w-full aspect-video object-contain bg-black" />
                  <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                    <span className="truncate text-gray-500" title={videoName ?? videoPath}>
                      {videoName ?? t('config.media.video_attached')}
                    </span>
                    <button type="button" onClick={clearVideo} className="text-red-500 hover:text-red-700">
                      {t('config.media.remove')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadVideo.isPending}
                  className="w-full aspect-video rounded border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-xs text-gray-500 disabled:opacity-60"
                >
                  {uploadVideo.isPending ? t('config.media.uploading') : t('config.media.video_pick')}
                </button>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                className="hidden"
                onChange={(e) => void handleVideoPick(e)}
              />
              <p className="text-[10px] text-gray-400 mt-1">{t('config.media.video_hint')}</p>
            </div>

            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1">{t('config.media.thumb_label')}</p>
              {thumbnailUrl ? (
                <div className="rounded border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={thumbnailUrl} alt="thumbnail" className="w-full aspect-video object-cover" />
                  <div className="flex items-center justify-end px-2 py-1 text-[11px]">
                    <button type="button" onClick={clearThumbnail} className="text-red-500 hover:text-red-700">
                      {t('config.media.remove')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploadThumb.isPending}
                  className="w-full aspect-video rounded border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-xs text-gray-500 disabled:opacity-60"
                >
                  {uploadThumb.isPending ? t('config.media.uploading') : t('config.media.thumb_pick')}
                </button>
              )}
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handleThumbPick(e)}
              />
              <p className="text-[10px] text-gray-400 mt-1">{t('config.media.thumb_hint')}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-medium text-gray-500 mb-1">
              {t('config.media.images_label', { count: imageUrls.length })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url, i) => (
                <div key={url + i} className="relative rounded border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={url} alt="" className="w-full aspect-square object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNoteImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                    aria-label={t('config.media.remove')}
                  >
                    ×
                  </button>
                </div>
              ))}
              {imageUrls.length < 9 && (
                <button
                  type="button"
                  onClick={() => noteInputRef.current?.click()}
                  disabled={uploadNote.isPending}
                  className="aspect-square rounded border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-2xl text-gray-400 disabled:opacity-60"
                >
                  {uploadNote.isPending ? '…' : '+'}
                </button>
              )}
            </div>
            <input
              ref={noteInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => void handleNotePick(e)}
            />
            <p className="text-[10px] text-gray-400 mt-1">{t('config.media.images_hint')}</p>
          </div>
        )}
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
              <button type="button" onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-700 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder={t('config.hashtag_placeholder')}
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <button type="button" onClick={addTag} className="text-xs bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600">
            +
          </button>
        </div>
      </div>

      {/* Scheduled at */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('config.scheduled_at')}
        </label>
        <DateTimePicker
          value={scheduledAt ? new Date(scheduledAt).toISOString() : ''}
          onChange={(iso) => setScheduledAt(iso ? iso : '')}
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
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
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

      {saveModalOpen && (
        <SaveTemplateModal
          onSave={handleSaveTemplate}
          onClose={() => setSaveModalOpen(false)}
        />
      )}
    </div>
  );
}
