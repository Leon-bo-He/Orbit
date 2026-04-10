import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateWorkspace, useUploadWorkspaceIcon } from '../../api/workspaces.js';
import { useUiStore } from '../../store/ui.store.js';
import { ColorPicker } from '../ui/ColorPicker.js';
import { WorkspaceIconContent, isIconUrl } from '../ui/WorkspaceIcon.js';

const EMOJI_OPTIONS = [
  '🎬', '📸', '✍️', '🎙', '📺', '🎮',
  '💄', '👗', '🍜', '✈️', '💪', '🐱',
  '🌿', '🎨', '📚', '🎵', '🏠',
  '💼', '🍕', '🎯', '🚀', '💡',
];

interface CreateWorkspaceModalProps {
  onClose: () => void;
}

export function CreateWorkspaceModal({ onClose }: CreateWorkspaceModalProps) {
  const { t } = useTranslation('workspaces');
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();
  const uploadIcon = useUploadWorkspaceIcon();
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspace);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(EMOJI_OPTIONS[0]!);
  const [customEmoji, setCustomEmoji] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [about, setAbout] = useState('');
  const [goalCount, setGoalCount] = useState(3);
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [nameError, setNameError] = useState('');

  function selectPreset(emoji: string) {
    setIcon(emoji);
    setCustomEmoji('');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadIcon.mutateAsync(file);
    setIcon(url.url);
    setCustomEmoji('');
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError(t('name_required')); return; }
    const result = await createWorkspace.mutateAsync({
      name: name.trim(),
      icon,
      color,
      about: about.trim() || undefined,
      publishGoal: { count: goalCount, period: goalPeriod },
    });
    setActiveWorkspace(result.id);
    onClose();
    void navigate(`/workspaces/${result.id}/board`);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('create_title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: color + '33' }}
              >
                <WorkspaceIconContent icon={icon} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {name || <span className="text-gray-400 font-normal">{t('name_placeholder')}</span>}
                </p>
                {about && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{about}</p>}
              </div>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('name')}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); }}
                placeholder={t('name_placeholder')}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
            </div>

            {/* Icon — 3 rows of 8: 22 presets + custom emoji cell + upload cell */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('icon_label')}</label>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => selectPreset(emoji)}
                    className={`text-xl rounded-lg py-1.5 transition-colors ${
                      icon === emoji && !customEmoji
                        ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
                {/* Custom emoji — one grid cell */}
                <input
                  type="text"
                  value={customEmoji}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCustomEmoji(e.target.value);
                    setIcon(val || EMOJI_OPTIONS[0]!);
                  }}
                  maxLength={10}
                  className={`text-xl text-center border rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-gray-700 dark:text-white transition-colors min-w-0 ${
                    customEmoji
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                />
                {/* Upload image — one grid cell */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadIcon.isPending}
                  title={isIconUrl(icon) ? t('icon_change_image') : t('icon_upload_image')}
                  className={`flex items-center justify-center rounded-lg py-1.5 border transition-colors min-w-0 ${
                    isIconUrl(icon)
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {uploadIcon.isPending ? (
                    <span className="text-xs">…</span>
                  ) : isIconUrl(icon) ? (
                    <img src={icon} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('color_label')}</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('about_label')}</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder={t('about_placeholder')}
                rows={2}
                maxLength={500}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
            </div>

            {/* Publish target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('publish_goal')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={goalPeriod}
                  onChange={(e) => setGoalPeriod(e.target.value as 'day' | 'week' | 'month')}
                  className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="day">{t('publish_period.day')}</option>
                  <option value="week">{t('publish_period.week')}</option>
                  <option value="month">{t('publish_period.month')}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={goalCount}
                  onChange={(e) => setGoalCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 text-center"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('publish_goal_unit')}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={createWorkspace.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createWorkspace.isPending ? '...' : t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
