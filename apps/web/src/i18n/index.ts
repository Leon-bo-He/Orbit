import i18n from 'i18next';
import type { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Read the persisted locale from localStorage before i18next initialises. */
function getStoredLocale(): SupportedLocale {
  try {
    const raw = localStorage.getItem('orbit-ui');
    if (raw) {
      const locale = (JSON.parse(raw) as { state?: { locale?: string } }).state?.locale;
      if (locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
        return locale as SupportedLocale;
      }
    }
  } catch { /* ignore */ }
  return 'en-US';
}

// Bundle all locale JSON files at build time — eliminates HTTP loading and all race conditions.
// import: 'default' ensures each entry is the parsed JSON object directly.
const localeModules = import.meta.glob('../locales/**/*.json', { eager: true, import: 'default' });

const resources: Resource = {};
for (const [path, mod] of Object.entries(localeModules)) {
  const match = path.match(/\/([^/]+)\/([^/]+)\.json$/);
  if (match) {
    const [, lang, ns] = match;
    if (lang && ns) {
      if (!resources[lang]) resources[lang] = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resources[lang]![ns] = mod as any;
    }
  }
}

void i18n
  .use(initReactI18next)
  .init({
    lng: getStoredLocale(),
    fallbackLng: 'en-US',
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: 'common',
    ns: ['common', 'ideas', 'workspaces', 'contents', 'publications', 'analytics'],
    resources,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
