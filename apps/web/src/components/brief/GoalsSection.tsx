import { useTranslation } from 'react-i18next';
import type { ContentPlan, ContentGoal, KpiTargets } from '@contentflow/shared';

interface GoalsSectionProps {
  plan: Partial<ContentPlan>;
  onChange: (patch: Partial<ContentPlan>) => void;
}

const GOAL_OPTIONS: { value: ContentGoal; icon: string; labelKey: string }[] = [
  { value: 'grow_followers', icon: '🔥', labelKey: 'brief.goals.grow_followers' },
  { value: 'convert', icon: '💰', labelKey: 'brief.goals.convert' },
  { value: 'traffic', icon: '🔗', labelKey: 'brief.goals.traffic' },
  { value: 'branding', icon: '📢', labelKey: 'brief.goals.branding' },
];

const KPI_KEYS: (keyof KpiTargets)[] = ['likes', 'comments', 'shares', 'followers'];

export function GoalsSection({ plan, onChange }: GoalsSectionProps) {
  const { t } = useTranslation('contents');
  const goals = plan.goals ?? [];
  const kpiTargets = plan.kpiTargets ?? {};

  function toggleGoal(goal: ContentGoal) {
    const next = goals.includes(goal)
      ? goals.filter((g) => g !== goal)
      : [...goals, goal];
    onChange({ goals: next });
  }

  function setKpi(key: keyof KpiTargets, value: string) {
    const num = value === '' ? undefined : Number(value);
    onChange({ kpiTargets: { ...kpiTargets, [key]: num } });
  }

  return (
    <div className="space-y-4">
      {/* Goal toggles */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">
          {t('brief.goals.goals_label')}
        </label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map(({ value, icon, labelKey }) => {
            const active = goals.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleGoal(value)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span>{icon}</span>
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Goal description */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('brief.goals.description_label')}
        </label>
        <textarea
          value={plan.goalDescription ?? ''}
          onChange={(e) => onChange({ goalDescription: e.target.value })}
          rows={3}
          placeholder={t('brief.goals.description_placeholder')}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>

      {/* KPI targets */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">
          {t('brief.goals.kpi_label')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {KPI_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">{t(`brief.goals.kpi_${key}`)}</span>
              <input
                type="number"
                min={0}
                value={kpiTargets[key] !== undefined ? kpiTargets[key] : ''}
                onChange={(e) => setKpi(key, e.target.value)}
                placeholder="—"
                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
