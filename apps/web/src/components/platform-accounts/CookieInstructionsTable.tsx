import { useTranslation } from 'react-i18next';
import type { PlatformId } from '../../api/platformAccounts.js';

interface PlatformInstruction {
  id: PlatformId;
  loginUrl: string;
  cookieDomains: string[];
  loginConfirmKey: string; // i18n key under platformAccounts.instructions.confirm.<id>
}

const INSTRUCTIONS: PlatformInstruction[] = [
  { id: 'douyin',       loginUrl: 'https://creator.douyin.com',     cookieDomains: ['.douyin.com'],                              loginConfirmKey: 'douyin' },
  { id: 'rednote',      loginUrl: 'https://creator.xiaohongshu.com', cookieDomains: ['.xiaohongshu.com'],                         loginConfirmKey: 'rednote' },
  { id: 'wechat_video', loginUrl: 'https://channels.weixin.qq.com',  cookieDomains: ['.weixin.qq.com', '.channels.weixin.qq.com'], loginConfirmKey: 'wechat_video' },
  { id: 'bilibili',     loginUrl: 'https://member.bilibili.com',     cookieDomains: ['.bilibili.com'],                            loginConfirmKey: 'bilibili' },
  { id: 'tiktok',       loginUrl: 'https://www.tiktok.com/upload',   cookieDomains: ['.tiktok.com'],                              loginConfirmKey: 'tiktok' },
  { id: 'youtube',      loginUrl: 'https://studio.youtube.com',      cookieDomains: ['.google.com', '.youtube.com', '.studio.youtube.com'], loginConfirmKey: 'youtube' },
  { id: 'instagram',    loginUrl: 'https://www.instagram.com',       cookieDomains: ['.instagram.com'],                           loginConfirmKey: 'instagram' },
  { id: 'facebook',     loginUrl: 'https://www.facebook.com',        cookieDomains: ['.facebook.com'],                            loginConfirmKey: 'facebook' },
  { id: 'x',            loginUrl: 'https://x.com',                   cookieDomains: ['.x.com', '.twitter.com'],                   loginConfirmKey: 'x' },
];

export function getInstructionsFor(platform: PlatformId): PlatformInstruction | undefined {
  return INSTRUCTIONS.find((p) => p.id === platform);
}

interface Props {
  platform?: PlatformId;
}

export function CookieInstructionsTable({ platform }: Props) {
  const { t } = useTranslation('platformAccounts');
  const rows = platform ? INSTRUCTIONS.filter((r) => r.id === platform) : INSTRUCTIONS;

  return (
    <div className="text-xs">
      <ol className="list-decimal pl-5 space-y-1 text-gray-700 dark:text-gray-300 mb-3">
        <li>{t('instructions.step_install')}</li>
        <li>{t('instructions.step_login')}</li>
        <li>{t('instructions.step_export')}</li>
        <li>{t('instructions.step_paste')}</li>
      </ol>
      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 font-medium">{t('instructions.col_platform')}</th>
              <th className="px-3 py-2 font-medium">{t('instructions.col_login_url')}</th>
              <th className="px-3 py-2 font-medium">{t('instructions.col_domains')}</th>
              <th className="px-3 py-2 font-medium">{t('instructions.col_confirm')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700 align-top">
                <td className="px-3 py-2 font-medium">{t(`platforms.${r.id}`)}</td>
                <td className="px-3 py-2">
                  <a href={r.loginUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">
                    {r.loginUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(r.loginUrl)}
                    className="ml-2 text-[10px] text-gray-400 hover:text-gray-600"
                    aria-label={t('instructions.copy')}
                  >
                    📋
                  </button>
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.cookieDomains.join(', ')}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {t(`instructions.confirm.${r.loginConfirmKey}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-gray-500 dark:text-gray-400">
        {t('instructions.multi_domain_note')}
      </p>
    </div>
  );
}
