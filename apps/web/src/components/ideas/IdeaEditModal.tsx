import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateIdea, useConvertIdea } from '../../api/ideas.js';
import { useDeleteContent } from '../../api/contents.js';
import { useWorkspaces } from '../../api/workspaces.js';
import { toast } from '../../store/toast.store.js';
import type { Idea } from '@contentflow/shared';

interface IdeaEditModalProps {
  idea: Idea;
  onClose: () => void;
}

type Priority = 'low' | 'medium' | 'high';
type Status = 'active' | 'converted' | 'archived';

export function IdeaEditModal({ idea, onClose }: IdeaEditModalProps) {
  const { t } = useTranslation('ideas');
  const updateIdea = useUpdateIdea();
  const convertIdea = useConvertIdea();
  const deleteContent = useDeleteContent();
  const { data: workspaces } = useWorkspaces();

  const [title, setTitle] = useState(idea.title);
  const [note, setNote] = useState(idea.note ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(idea.tags);
  const [priority, setPriority] = useState<Priority>(idea.priority as Priority);
  const [status, setStatus] = useState<Status>(idea.status as Status);
  const [workspaceId, setWorkspaceId] = useState(idea.workspaceId ?? '');

  // Convert-to-content dialog
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertWorkspaceId, setConvertWorkspaceId] = useState(idea.workspaceId ?? workspaces?.[0]?.id ?? '');
  const [convertTitle, setConvertTitle] = useState(idea.title);

  // Revert-to-active confirmation dialog
  const [showRevertDialog, setShowRevertDialog] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  // Keep convert workspace default in sync when workspaces load
  useEffect(() => {
    if (!convertWorkspaceId && workspaces?.length) {
      setConvertWorkspaceId(idea.workspaceId ?? workspaces[0]?.id ?? '');
    }
  }, [workspaces, convertWorkspaceId, idea.workspaceId]);

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

  function handleStatusClick(next: Status) {
    if (next === 'converted' && idea.status === 'active') {
      // Prompt to create content
      setConvertTitle(title.trim() || idea.title);
      setShowConvertDialog(true);
      return;
    }
    if (next === 'active' && (idea.status === 'converted' || idea.status === 'archived')) {
      // Warn that linked content will be deleted
      setShowRevertDialog(true);
      return;
    }
    setStatus(next);
  }

  async function handleConfirmConvert() {
    if (!convertWorkspaceId) return;
    try {
      await convertIdea.mutateAsync({
        id: idea.id,
        data: { workspaceId: convertWorkspaceId, title: convertTitle.trim() || undefined },
      });
      setShowConvertDialog(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('convert_error'));
    }
  }

  async function handleConfirmRevert() {
    // Delete linked content if present
    if (idea.convertedTo) {
      await deleteContent.mutateAsync({ id: idea.convertedTo, workspaceId: idea.workspaceId ?? '' });
    }
    await updateIdea.mutateAsync({
      id: idea.id,
      data: { status: 'active', convertedTo: null },
    });
    setShowRevertDialog(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await updateIdea.mutateAsync({
      id: idea.id,
      data: {
        title: title.trim(),
        note: note.trim() || null,
        tags,
        priority,
        status,
        workspaceId: workspaceId || null,
      },
    });
    onClose();
  }

  const priorityOptions: { value: Priority; label: string; dot: string; activeBg: string; activeText: string }[] = [
    { value: 'low',    label: t('priority.low'),    dot: 'bg-gray-400',  activeBg: 'bg-white shadow-sm', activeText: 'text-gray-700' },
    { value: 'medium', label: t('priority.medium'), dot: 'bg-amber-400', activeBg: 'bg-white shadow-sm', activeText: 'text-amber-600' },
    { value: 'high',   label: t('priority.high'),   dot: 'bg-red-500',   activeBg: 'bg-white shadow-sm', activeText: 'text-red-600' },
  ];

  const statusOptions: { value: Status; label: string; dot: string; activeBg: string; activeText: string }[] = [
    { value: 'active',    label: t('status.active'),    dot: 'bg-indigo-500', activeBg: 'bg-white shadow-sm', activeText: 'text-indigo-600' },
    { value: 'converted', label: t('status.converted'), dot: 'bg-green-500',  activeBg: 'bg-white shadow-sm', activeText: 'text-green-600' },
    { value: 'archived',  label: t('status.archived'),  dot: 'bg-gray-400',   activeBg: 'bg-white shadow-sm', activeText: 'text-gray-600' },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col flex-1 min-h-0">
            <div className="p-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">{t('edit_title')}</h2>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('fields.title')}<span className="text-red-500 ml-0.5">*</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.note')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.tags')}</label>
                <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent min-h-[42px]">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-medium px-2 py-0.5 rounded-full"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="text-indigo-200 hover:text-white leading-none">×</button>
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

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fields.status')}</label>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleStatusClick(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        status === opt.value
                          ? `${opt.activeBg} ${opt.activeText}`
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot} ${status !== opt.value ? 'opacity-50' : ''}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('fields.priority')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.workspace')}</label>
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">{t('fields.no_workspace')}</option>
                  {workspaces?.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.icon} {ws.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex-shrink-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {t('action.cancel')}
              </button>
              <button
                type="submit"
                disabled={!title.trim() || updateIdea.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateIdea.isPending ? '…' : t('action.save')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Convert-to-content dialog */}
      {showConvertDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t('convert_dialog.title')}</h3>
            <p className="text-sm text-gray-500">{t('convert_dialog.description')}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('convert_dialog.content_title')}</label>
                <input
                  type="text"
                  value={convertTitle}
                  onChange={(e) => setConvertTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('convert_dialog.workspace')}</label>
                <select
                  value={convertWorkspaceId}
                  onChange={(e) => setConvertWorkspaceId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="" disabled>{t('fields.no_workspace')}</option>
                  {workspaces?.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.icon} {ws.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConvertDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                disabled={!convertWorkspaceId || convertIdea.isPending}
                onClick={() => { void handleConfirmConvert(); }}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {convertIdea.isPending ? '…' : t('convert_dialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert-to-active confirmation dialog */}
      {showRevertDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t('revert_dialog.title')}</h3>
            <p className="text-sm text-gray-500">
              {idea.convertedTo
                ? t('revert_dialog.description_with_content')
                : t('revert_dialog.description')}
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowRevertDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                disabled={updateIdea.isPending || deleteContent.isPending}
                onClick={() => { void handleConfirmRevert(); }}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {(updateIdea.isPending || deleteContent.isPending) ? '…' : t('revert_dialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
