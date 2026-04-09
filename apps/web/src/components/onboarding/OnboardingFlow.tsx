import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateWorkspace } from '../../api/workspaces.js';
import { useLogout } from '../../api/auth.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useUiStore } from '../../store/ui.store.js';
import { ColorPicker } from '../ui/ColorPicker.js';

const EMOJI_OPTIONS = [
  '🎬', '📸', '✍️', '🎙', '📺', '🎮',
  '💄', '👗', '🍜', '✈️', '💪', '🐱',
  '🌿', '🎨', '🏋️', '📚', '🎵', '🏠',
  '💼', '🌍', '🍕', '🎯', '🚀', '💡',
];

type Step = 'welcome' | 'create';

export function OnboardingFlow() {
  const { t } = useTranslation('workspaces');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspace);

  const clearAuth = useAuthStore((s) => s.clearAuth);
  const logoutMutation = useLogout();

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(EMOJI_OPTIONS[0]!);
  const [color, setColor] = useState('#6366f1');
  const [goalCount, setGoalCount] = useState(3);
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [nameError, setNameError] = useState('');

  function handleSignOut() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuth();
        void navigate('/login', { replace: true });
      },
      onError: () => {
        clearAuth();
        void navigate('/login', { replace: true });
      },
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError(t('name_required')); return; }
    const result = await createWorkspace.mutateAsync({
      name: name.trim(),
      icon,
      color,
      publishGoal: { count: goalCount, period: goalPeriod },
    });
    setActiveWorkspace(result.id);
    void navigate(`/workspaces/${result.id}/board`);
  }

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center" style={{ background: 'var(--cf-bg)' }}>
        <button
          onClick={handleSignOut}
          disabled={logoutMutation.isPending}
          className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {tc('auth.sign_out')}
        </button>
        <div className="text-6xl mb-6 select-none">✦</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {t('onboarding.welcome_title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mb-8">
          {t('onboarding.welcome_desc')}
        </p>
        <button
          onClick={() => setStep('create')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
        >
          {t('onboarding.get_started')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--cf-bg)' }}>
      <div className="min-h-full flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-md pb-10">
          {/* Back + progress + sign out */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => setStep('welcome')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-600" />
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <button
              onClick={handleSignOut}
              disabled={logoutMutation.isPending}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              {tc('auth.sign_out')}
            </button>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {t('onboarding.create_title')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('onboarding.create_desc')}
          </p>

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-5">
            {/* Live preview */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: color + '33' }}
              >
                {icon}
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white flex-1 truncate">
                {name || <span className="font-normal text-gray-400">{t('name_placeholder')}</span>}
              </p>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('name')}
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); }}
                placeholder={t('name_placeholder')}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('icon_label')}
              </label>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`text-xl rounded-lg py-1.5 transition-colors ${
                      icon === emoji
                        ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('color_label')}
              </label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {/* Publish goal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('publish_goal')}
              </label>
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

            <button
              type="submit"
              disabled={createWorkspace.isPending}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {createWorkspace.isPending ? '…' : t('onboarding.create_button')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
