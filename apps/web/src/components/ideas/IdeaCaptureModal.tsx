import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateIdea } from '../../api/ideas.js';
import { useWorkspaces } from '../../api/workspaces.js';

interface IdeaCaptureModalProps {
  open: boolean;
  onClose: () => void;
}

type Priority = 'low' | 'medium' | 'high';

export function IdeaCaptureModal({ open, onClose }: IdeaCaptureModalProps) {
  const { t } = useTranslation('ideas');
  const createIdea = useCreateIdea();
  const { data: workspaces } = useWorkspaces();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [workspaceId, setWorkspaceId] = useState<string>('');

  const titleRef = useRef<HTMLInputElement>(null);

  // Autofocus title when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setTitle('');
      setNote('');
      setTagInput('');
      setTags([]);
      setPriority('medium');
      setWorkspaceId('');
    }
  }, [open]);

  function addTag(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    await createIdea.mutateAsync({
      title: title.trim(),
      note: note.trim() || undefined,
      tags,
      priority,
      workspaceId: workspaceId || undefined,
      attachments: [],
    });

    onClose();
  }

  if (!open) return null;

  const priorityOptions: { value: Priority; label: string; dot: string; activeBg: string; activeText: string }[] = [
    { value: 'low',    label: t('priority.low'),    dot: 'bg-gray-400',   activeBg: 'bg-white shadow-sm', activeText: 'text-gray-700' },
    { value: 'medium', label: t('priority.medium'), dot: 'bg-amber-400',  activeBg: 'bg-white shadow-sm', activeText: 'text-amber-600' },
    { value: 'high',   label: t('priority.high'),   dot: 'bg-red-500',    activeBg: 'bg-white shadow-sm', activeText: 'text-red-600' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{t('quick_capture')}</h2>
          </div>

          <div className="p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.title')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('fields.title_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.note')}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('fields.note_placeholder')}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.tags')}
              </label>
              <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent min-h-[42px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-medium px-2 py-0.5 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-indigo-200 hover:text-white leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length === 0 ? t('fields.tags_placeholder') : ''}
                  className="flex-1 min-w-[100px] text-sm outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('fields.priority')}
              </label>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      priority === opt.value
                        ? `${opt.activeBg} ${opt.activeText}`
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot} ${priority !== opt.value ? 'opacity-50' : ''}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Workspace */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.workspace')}
              </label>
              <select
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">{t('fields.no_workspace')}</option>
                {workspaces?.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.icon} {ws.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createIdea.isPending}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createIdea.isPending ? '…' : t('quick_capture')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
