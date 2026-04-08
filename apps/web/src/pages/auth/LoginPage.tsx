import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogin } from '../../api/auth.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useUiStore } from '../../store/ui.store.js';
import i18n from '../../i18n/index.js';
import { toast } from '../../store/toast.store.js';
import { ApiError } from '../../api/client.js';
import LanguageSwitcher from '../../components/auth/LanguageSwitcher.js';

type Theme = 'system' | 'light' | 'dark';
const THEME_ICONS: Record<Theme, string> = { system: '💻', light: '☀️', dark: '🌙' };

export default function LoginPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loginMutation = useLogin();
  const { theme, setTheme, setLocale } = useUiStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      setAuth(result.user, result.accessToken);
      if (result.user.locale) {
        setLocale(result.user.locale as Parameters<typeof setLocale>[0]);
        void i18n.changeLanguage(result.user.locale);
      }
      if (result.user.appearance) {
        setTheme(result.user.appearance as Parameters<typeof setTheme>[0]);
      }
      toast.clear();
      const redirect = searchParams.get('redirect') ?? '/';
      void navigate(redirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorMsg(t('auth.invalid_credentials'));
      } else {
        setErrorMsg(t('status.error'));
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
<div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-indigo-600">ContentFlow</span>
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Language — top right */}
          <div className="absolute top-4 right-4">
            <LanguageSwitcher />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('auth.welcome_back')}</h1>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t('aria.hide_password') : t('aria.show_password')}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loginMutation.isPending && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {t('auth.sign_in')}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('auth.sign_up')}
            </Link>
          </p>

          {/* Theme — bottom center */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-center gap-1">
            {(['system', 'light', 'dark'] as Theme[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTheme(m)}
                title={t(`settings.general.theme_${m}`)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                  theme === m
                    ? 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {THEME_ICONS[m]}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
