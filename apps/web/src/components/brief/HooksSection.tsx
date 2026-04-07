import { useTranslation } from 'react-i18next';
import type { ContentPlan, HookAnalysis } from '@contentflow/shared';

interface HooksSectionProps {
  plan: Partial<ContentPlan>;
  onChange: (patch: Partial<ContentPlan>) => void;
}

function emptyHooks(): HookAnalysis {
  return { coreHook: '', conflict: '', goldenOpening: '', memoryPoint: '' };
}

export function HooksSection({ plan, onChange }: HooksSectionProps) {
  const { t } = useTranslation('contents');
  const hooks = plan.hooks ?? emptyHooks();

  function patchHooks(patch: Partial<HookAnalysis>) {
    onChange({ hooks: { ...hooks, ...patch } });
  }

  return (
    <div className="space-y-4">
      {/* Core hook */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.hooks.core_hook_label')}
        </label>
        <input
          type="text"
          value={hooks.coreHook}
          onChange={(e) => patchHooks({ coreHook: e.target.value })}
          placeholder={t('brief.hooks.core_hook_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Conflict / contrast */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.hooks.conflict_label')}
        </label>
        <textarea
          value={hooks.conflict}
          onChange={(e) => patchHooks({ conflict: e.target.value })}
          rows={3}
          placeholder={t('brief.hooks.conflict_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Golden 3-second opening */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.hooks.golden_opening_label')}
        </label>
        <textarea
          value={hooks.goldenOpening}
          onChange={(e) => patchHooks({ goldenOpening: e.target.value })}
          rows={3}
          placeholder={t('brief.hooks.golden_opening_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* Memory anchor */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.hooks.memory_anchor_label')}
        </label>
        <input
          type="text"
          value={hooks.memoryPoint}
          onChange={(e) => patchHooks({ memoryPoint: e.target.value })}
          placeholder={t('brief.hooks.memory_anchor_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
    </div>
  );
}
