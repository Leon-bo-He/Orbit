import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ContentPlan, UpsertContentPlanInput } from '@orbit/shared';
import { useContents } from '../api/contents.js';
import {
  useContentPlan,
  useUpsertPlan,
  useContentReferences,
  useAddReference,
  useDeleteReference,
  usePlanTemplates,
  useCreatePlanTemplate,
  useRenamePlanTemplate,
  useDeletePlanTemplate,
} from '../api/content-plans.js';
import { FormatSection } from '../components/brief/FormatSection.js';
import { AudienceSection } from '../components/brief/AudienceSection.js';
import { GoalsSection } from '../components/brief/GoalsSection.js';
import { HooksSection } from '../components/brief/HooksSection.js';
import { TitlesSection } from '../components/brief/TitlesSection.js';
import { OutlineSection } from '../components/brief/OutlineSection.js';
import { ReferencesSection } from '../components/brief/ReferencesSection.js';
import type { CreateContentReferenceInput, CreatePlanTemplateInput } from '@orbit/shared';
import { AiGenerateButton } from '../components/brief/AiGenerateButton.js';
import type { BriefContext } from '../api/brief.js';

// ── Accordion ────────────────────────────────────────────────────────────────

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function Accordion({ title, defaultOpen = false, children, action }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center bg-gray-50 hover:bg-gray-100 transition-colors px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between text-left"
        >
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          <span className={`text-gray-400 transition-transform mr-2 ${open ? 'rotate-90' : ''}`}>›</span>
        </button>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ── SaveIndicator ─────────────────────────────────────────────────────────────

function SaveIndicator({ saving }: { saving: boolean }) {
  const { t } = useTranslation('contents');
  const [showCheck, setShowCheck] = useState(false);
  const prevSaving = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (prevSaving.current && !saving) {
      setShowCheck(true);
      timer = setTimeout(() => setShowCheck(false), 2000);
    }
    prevSaving.current = saving;
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, [saving]);

  if (saving) {
    return <span className="text-xs text-gray-400">{t('brief.saving')}</span>;
  }
  if (showCheck) {
    return <span className="text-xs text-green-500">✓ {t('brief.saved')}</span>;
  }
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContentBrief() {
  const { workspaceId = '', contentId = '' } = useParams<{
    workspaceId: string;
    contentId: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation('contents');

  const { data: contents = [] } = useContents(workspaceId);
  const content = contents.find((c) => c.id === contentId);

  const { data: remotePlan } = useContentPlan(contentId);
  const upsertPlan = useUpsertPlan(contentId);

  const { data: references = [] } = useContentReferences(contentId);
  const addReference = useAddReference(contentId);
  const deleteReference = useDeleteReference(contentId);

  const { data: templates = [] } = usePlanTemplates(workspaceId);
  const createTemplate = useCreatePlanTemplate(workspaceId);
  const renameTemplate = useRenamePlanTemplate(workspaceId);
  const deleteTemplate = useDeletePlanTemplate(workspaceId);

  // Local plan state — initialised from server data
  const [localPlan, setLocalPlan] = useState<Partial<ContentPlan>>({});
  const initialized = useRef(false);

  useEffect(() => {
    if (remotePlan !== undefined && !initialized.current) {
      setLocalPlan(remotePlan ?? {});
      initialized.current = true;
    }
  }, [remotePlan]);

  // Auto-save with debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (patch: Partial<ContentPlan>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const input: UpsertContentPlanInput = {};
        if (patch.formatConfig !== undefined) input.formatConfig = patch.formatConfig;
        if (patch.audience !== undefined) input.audience = patch.audience;
        if (patch.audienceTemplateId !== undefined) input.audienceTemplateId = patch.audienceTemplateId;
        if (patch.goals !== undefined) input.goals = patch.goals;
        if (patch.goalDescription !== undefined) input.goalDescription = patch.goalDescription;
        if (patch.kpiTargets !== undefined) input.kpiTargets = patch.kpiTargets;
        if (patch.hooks !== undefined) input.hooks = patch.hooks;
        if (patch.titleCandidates !== undefined) input.titleCandidates = patch.titleCandidates;
        if (patch.outline !== undefined) input.outline = patch.outline;
        upsertPlan.mutate(input);
      }, 800);
    },
    [upsertPlan]
  );

  function handleChange(patch: Partial<ContentPlan>) {
    const next = { ...localPlan, ...patch };
    setLocalPlan(next);
    scheduleSave(next);
  }

  function handleAddReference(input: CreateContentReferenceInput) {
    addReference.mutate(input);
  }

  function handleDeleteReference(refId: string) {
    deleteReference.mutate(refId);
  }

  function handleSaveTemplate(input: CreatePlanTemplateInput) {
    createTemplate.mutate(input);
  }

  function handleRenameTemplate(templateId: string, name: string) {
    renameTemplate.mutate({ templateId, name });
  }

  function handleDeleteTemplate(templateId: string) {
    deleteTemplate.mutate(templateId);
  }

  // Pending AI-generated titles — shown in a confirm dialog before applying
  const [pendingTitles, setPendingTitles] = useState<ContentPlan['titleCandidates'] | null>(null);

  function handleTitlesGenerated(result: unknown) {
    setPendingTitles(result as ContentPlan['titleCandidates']);
  }

  function applyTitles(mode: 'replace' | 'add') {
    if (!pendingTitles) return;
    const existing = (localPlan.titleCandidates ?? []) as ContentPlan['titleCandidates'];
    if (mode === 'replace') {
      handleChange({ titleCandidates: pendingTitles });
    } else {
      // Merge — mark existing primaries unchanged, new ones as non-primary
      const merged = [
        ...existing,
        ...pendingTitles.map((t) => ({ ...t, isPrimary: false })),
      ];
      handleChange({ titleCandidates: merged });
    }
    setPendingTitles(null);
  }

  // Build AI context from current plan + content
  const audienceText = localPlan.audience
    ? `${(localPlan.audience as { ageRange?: string }).ageRange ?? ''} — ${(localPlan.audience as { painPoints?: string }).painPoints ?? ''}`
    : undefined;
  const hooksText = (localPlan.hooks as { coreHook?: string } | null | undefined)?.coreHook;
  const briefContext: BriefContext = {
    contentTitle: content?.title ?? '',
    contentType: content?.contentType ?? '',
    ...(audienceText !== undefined && { audience: audienceText }),
    goals: (localPlan.goals as string[] | undefined) ?? [],
    ...(hooksText !== undefined && { hooks: hooksText }),
  };

  if (!content) {
    return (
      <div className="p-8 text-center text-gray-400">
        {contentId ? t('brief.not_found') : t('status.loading', { ns: 'common' })}
      </div>
    );
  }

  const STAGE_COLORS: Record<string, string> = {
    planned: 'bg-gray-100 text-gray-600',
    planning: 'bg-blue-100 text-blue-700',
    creating: 'bg-yellow-100 text-yellow-700',
    ready: 'bg-green-100 text-green-700',
    publishing: 'bg-purple-100 text-purple-700',
    published: 'bg-indigo-100 text-indigo-700',
    reviewed: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate(`/workspaces/${workspaceId}/board`)}
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
        >
          ← {t('brief.back_to_board')}
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{content.title}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              STAGE_COLORS[content.stage] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {t(`stages.${content.stage}`)}
          </span>
        </div>
        <SaveIndicator saving={upsertPlan.isPending} />
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
        {/* ① Format Config */}
        <Accordion title={t('brief.sections.format')} defaultOpen>
          <FormatSection contentType={content.contentType} plan={localPlan} onChange={handleChange} />
        </Accordion>

        {/* ② Audience Profile */}
        <Accordion
          title={t('brief.sections.audience')}
          action={
            <AiGenerateButton
              section="audience"
              context={briefContext}
              onResult={(r) => handleChange({ audience: r as ContentPlan['audience'] })}
            />
          }
        >
          <AudienceSection
            plan={localPlan}
            templates={templates}
            onChange={handleChange}
            onSaveTemplate={handleSaveTemplate}
            onRenameTemplate={handleRenameTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        </Accordion>

        {/* ③ Content Goals */}
        <Accordion
          title={t('brief.sections.goals')}
          action={
            <AiGenerateButton
              section="goals"
              context={briefContext}
              onResult={(r) => {
                const g = r as { goals?: ContentPlan['goals']; goalDescription?: string; kpiTargets?: ContentPlan['kpiTargets'] };
                handleChange({
                  ...(g.goals !== undefined && { goals: g.goals }),
                  ...(g.goalDescription !== undefined && { goalDescription: g.goalDescription }),
                  ...(g.kpiTargets !== undefined && { kpiTargets: g.kpiTargets }),
                });
              }}
            />
          }
        >
          <GoalsSection plan={localPlan} onChange={handleChange} />
        </Accordion>

        {/* ④ Hook Analysis */}
        <Accordion
          title={t('brief.sections.hooks')}
          action={
            <AiGenerateButton
              section="hooks"
              context={briefContext}
              onResult={(r) => handleChange({ hooks: r as ContentPlan['hooks'] })}
            />
          }
        >
          <HooksSection plan={localPlan} onChange={handleChange} />
        </Accordion>

        {/* ⑤ Title Candidates */}
        <Accordion
          title={t('brief.sections.titles')}
          action={
            <AiGenerateButton
              section="titles"
              context={briefContext}
              onResult={handleTitlesGenerated}
            />
          }
        >
          <TitlesSection plan={localPlan} onChange={handleChange} />
        </Accordion>

        {/* AI Titles confirm dialog */}
        {pendingTitles && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('brief.ai.titles_dialog_title')}</h3>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {pendingTitles.map((title, i) => (
                  <li key={i} className="text-sm text-gray-700 px-3 py-1.5 bg-gray-50 rounded-md">
                    {title.text}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPendingTitles(null)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {t('action.cancel', { ns: 'common' })}
                </button>
                <button
                  onClick={() => applyTitles('add')}
                  className="text-sm px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  {t('brief.ai.titles_add')}
                </button>
                <button
                  onClick={() => applyTitles('replace')}
                  className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {t('brief.ai.titles_replace')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ⑥ Content Outline */}
        <Accordion
          title={t('brief.sections.outline')}
          action={
            <AiGenerateButton
              section="outline"
              context={briefContext}
              onResult={(r) => handleChange({ outline: r as ContentPlan['outline'] })}
            />
          }
        >
          <OutlineSection plan={localPlan} onChange={handleChange} />
        </Accordion>

        {/* ⑦ Competitive References — no AI generation, keep as-is */}
        <Accordion title={t('brief.sections.references')}>
          <ReferencesSection
            contentId={contentId}
            references={references}
            onAdd={handleAddReference}
            onDelete={handleDeleteReference}
          />
        </Accordion>
      </div>
    </div>
  );
}
