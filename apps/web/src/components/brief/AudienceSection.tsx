import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ContentPlan, AudienceProfile, PlanTemplate, CreatePlanTemplateInput } from '@orbit/shared';

interface AudienceSectionProps {
  plan: Partial<ContentPlan>;
  templates: PlanTemplate[];
  onChange: (patch: Partial<ContentPlan>) => void;
  onSaveTemplate: (input: CreatePlanTemplateInput) => void;
  onRenameTemplate: (templateId: string, name: string) => void;
  onDeleteTemplate: (templateId: string) => void;
}

function emptyAudience(): AudienceProfile {
  return { ageRange: '', personaTags: [], painPoints: '', reachScenario: '' };
}

export function AudienceSection({ plan, templates, onChange, onSaveTemplate, onRenameTemplate, onDeleteTemplate }: AudienceSectionProps) {
  const { t } = useTranslation('contents');
  const audience = plan.audience ?? emptyAudience();

  const [newTag, setNewTag] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const loadBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Recalculate dropdown position on open, scroll, and resize
  useEffect(() => {
    if (!showTemplateDropdown) return;

    function updatePosition() {
      if (!loadBtnRef.current) return;
      const rect = loadBtnRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: 264,
        zIndex: 9999,
      });
    }

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showTemplateDropdown]);

  // Click-outside to close
  useEffect(() => {
    if (!showTemplateDropdown) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        loadBtnRef.current && !loadBtnRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setShowTemplateDropdown(false);
        setRenamingId(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showTemplateDropdown]);

  function openDropdown() {
    setShowTemplateDropdown((o) => !o);
    setRenamingId(null);
  }

  function patchAudience(patch: Partial<AudienceProfile>) {
    onChange({ audience: { ...audience, ...patch } });
  }

  function addTag() {
    const tag = newTag.trim();
    if (!tag || audience.personaTags.includes(tag)) { setNewTag(''); return; }
    patchAudience({ personaTags: [...audience.personaTags, tag] });
    setNewTag('');
  }

  function removeTag(tag: string) {
    patchAudience({ personaTags: audience.personaTags.filter((t) => t !== tag) });
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    const input: CreatePlanTemplateInput = {
      name,
      audience: { ...audience },
      goals: plan.goals ?? [],
    };
    if (plan.goalDescription) input.goalDescription = plan.goalDescription;
    onSaveTemplate(input);
    setShowSaveModal(false);
    setTemplateName('');
  }

  function applyTemplate(tpl: PlanTemplate) {
    onChange({
      audience: tpl.audience ?? emptyAudience(),
      goals: tpl.goals,
      ...(tpl.goalDescription != null && { goalDescription: tpl.goalDescription }),
      audienceTemplateId: tpl.id,
    });
    setShowTemplateDropdown(false);
  }

  function startRename(e: React.MouseEvent, tpl: PlanTemplate) {
    e.stopPropagation();
    setRenamingId(tpl.id);
    setRenameValue(tpl.name);
  }

  function commitRename(templateId: string) {
    const name = renameValue.trim();
    if (name) onRenameTemplate(templateId, name);
    setRenamingId(null);
  }

  function handleDelete(e: React.MouseEvent, templateId: string) {
    e.stopPropagation();
    setDeleteConfirmId(templateId);
    setShowTemplateDropdown(false);
  }

  return (
    <div className="space-y-4">
      {/* Age range */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.audience.age_range_label')}
        </label>
        <input
          type="text"
          value={audience.ageRange}
          onChange={(e) => patchAudience({ ageRange: e.target.value })}
          placeholder={t('brief.audience.age_range_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Persona tags */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.audience.persona_tags_label')}
        </label>
        <div className="flex flex-wrap gap-1 mb-2">
          {audience.personaTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder={t('brief.audience.persona_tags_placeholder')}
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <button onClick={addTag} className="text-xs bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600">+</button>
        </div>
      </div>

      {/* Pain points */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.audience.pain_points_label')}
        </label>
        <textarea
          value={audience.painPoints}
          onChange={(e) => patchAudience({ painPoints: e.target.value })}
          rows={3}
          placeholder={t('brief.audience.pain_points_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Reach scenario */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.audience.reach_scenario_label')}
        </label>
        <textarea
          value={audience.reachScenario}
          onChange={(e) => patchAudience({ reachScenario: e.target.value })}
          rows={3}
          placeholder={t('brief.audience.reach_scenario_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Template actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setShowSaveModal(true)}
          className="text-xs border border-indigo-300 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-50"
        >
          {t('brief.audience.save_template')}
        </button>
        <button
          ref={loadBtnRef}
          onClick={openDropdown}
          className={`text-xs border px-3 py-1.5 rounded transition-colors ${
            showTemplateDropdown
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {t('brief.audience.load_template')}
          {templates.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5">
              {templates.length}
            </span>
          )}
        </button>
      </div>

      {/* Template dropdown — portal so it escapes overflow:hidden and tracks scroll */}
      {showTemplateDropdown && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {t('brief.audience.load_template')}
            </span>
            <span className="text-[11px] text-gray-400">{templates.length}</span>
          </div>

          {templates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">{t('brief.audience.no_templates')}</p>
            </div>
          ) : (
            <div className="py-1.5 max-h-64 overflow-y-auto">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="mx-1.5 flex items-center rounded-xl hover:bg-gray-50 group transition-colors"
                >
                  {renamingId === tpl.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(tpl.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => commitRename(tpl.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm px-3 py-2.5 outline-none bg-transparent font-medium"
                    />
                  ) : (
                    <button
                      onClick={() => applyTemplate(tpl)}
                      className="flex-1 text-left text-sm px-3 py-2.5 text-gray-700 font-medium truncate"
                    >
                      {tpl.name}
                    </button>
                  )}
                  <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => startRename(e, tpl)}
                      title={t('brief.audience.rename_template')}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, tpl.id)}
                      title={t('brief.audience.delete_template')}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* Delete template confirmation */}
      {deleteConfirmId && (() => {
        const tpl = templates.find((t) => t.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-xl p-5 w-72">
              <p className="text-sm font-semibold text-gray-900 mb-1">{t('brief.audience.delete_template_confirm_title')}</p>
              <p className="text-xs text-gray-500 mb-4">
                {t('brief.audience.delete_template_confirm_desc', { name: tpl?.name ?? '' })}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
                >
                  {t('create.cancel')}
                </button>
                <button
                  onClick={() => { onDeleteTemplate(deleteConfirmId); setDeleteConfirmId(null); }}
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
                >
                  {t('brief.audience.delete_template')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Save template modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {t('brief.audience.save_template_modal_title')}
            </h3>
            <input
              autoFocus
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); }}
              placeholder={t('brief.audience.template_name_placeholder')}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowSaveModal(false); setTemplateName(''); }}
                className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
              >
                {t('create.cancel')}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('brief.audience.save_template_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
