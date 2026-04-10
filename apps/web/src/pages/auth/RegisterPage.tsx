import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRegister } from '../../api/auth.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useUiStore } from '../../store/ui.store.js';
import { toast } from '../../store/toast.store.js';
import { ApiError } from '../../api/client.js';
import LanguageSwitcher from '../../components/auth/LanguageSwitcher.js';
import OrbitLogo from '../../components/ui/OrbitLogo.js';

type Theme = 'system' | 'light' | 'dark';
const THEME_ICONS: Record<Theme, string> = { system: '💻', light: '☀️', dark: '🌙' };

export default function RegisterPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { theme, setTheme } = useUiStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const registerMutation = useRegister();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      const msg = t('auth.password_too_short');
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = t('auth.password_mismatch');
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    try {
      const result = await registerMutation.mutateAsync({ email, username, password });
      setAuth(result.user, result.accessToken);
      void navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = t('auth.email_taken');
        setErrorMsg(msg);
        toast.error(msg);
      } else if (err instanceof ApiError && err.status === 400) {
        const msg = err.message;
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        const msg = t('status.error');
        setErrorMsg(msg);
        toast.error(msg);
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <OrbitLogo variant="full" className="h-20 w-auto text-slate-900 dark:text-white" />
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Language — top right */}
          <div className="absolute top-4 right-4">
            <LanguageSwitcher />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('auth.create_account')}</h1>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.name')}
              </label>
              <input
                type="text"
                autoComplete="name"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

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
                  autoComplete="new-password"
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.confirm_password')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {registerMutation.isPending && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {t('auth.sign_up')}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('auth.have_account')}{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('auth.sign_in')}
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
