import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentPlan, AudienceProfile, PlanTemplate, CreatePlanTemplateInput } from '@contentflow/shared';

interface AudienceSectionProps {
  plan: Partial<ContentPlan>;
  templates: PlanTemplate[];
  onChange: (patch: Partial<ContentPlan>) => void;
  onSaveTemplate: (input: CreatePlanTemplateInput) => void;
}

function emptyAudience(): AudienceProfile {
  return { ageRange: '', personaTags: [], painPoints: '', reachScenario: '' };
}

export function AudienceSection({ plan, templates, onChange, onSaveTemplate }: AudienceSectionProps) {
  const { t } = useTranslation('contents');
  const audience = plan.audience ?? emptyAudience();

  const [newTag, setNewTag] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

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
    if (plan.goalDescription) {
      input.goalDescription = plan.goalDescription;
    }
    onSaveTemplate(input);
    setShowSaveModal(false);
    setTemplateName('');
  }

  function applyTemplate(tpl: PlanTemplate) {
    if (tpl.audience) {
      const patch: Partial<ContentPlan> = {
        audience: tpl.audience,
        goals: tpl.goals,
        goalDescription: tpl.goalDescription,
        audienceTemplateId: tpl.id,
      };
      onChange(patch);
    }
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
              <button
                onClick={() => removeTag(tag)}
                className="text-indigo-400 hover:text-indigo-700 leading-none"
              >×</button>
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
          <button
            onClick={addTag}
            className="text-xs bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
          >+</button>
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
        <div className="relative">
          <button
            onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
            className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50"
          >
            {t('brief.audience.load_template')}
          </button>
          {showTemplateDropdown && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-10">
              {templates.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2">{t('brief.audience.no_templates')}</p>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    {tpl.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save template modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
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
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 mb-4"
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
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
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
