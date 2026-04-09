import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedLocale } from '../i18n/index.js';

export type Theme = 'system' | 'light' | 'dark';

export interface PublicationTemplate {
  id: string;
  name: string;
  platformTitle?: string;
  platformCopy?: string;
  platformTags?: string[];
  visibility?: 'public' | 'private' | 'friends';
  allowComments?: boolean;
}

export interface PlatformBundleItem {
  platform: string;
  time: string; // "HH:MM" or "" for no specific time
}

export interface PlatformBundle {
  id: string;
  name: string;
  items: PlatformBundleItem[];
}

interface UiState {
  activeWorkspaceId: string | null;
  locale: SupportedLocale;
  sidebarCollapsed: boolean;
  theme: Theme;
  disabledBuiltinPlatforms: string[];
  disabledCustomPlatforms: string[];
  publicationTemplates: PublicationTemplate[];
  platformBundles: PlatformBundle[];
  settingsSection: string | null; // null = closed
  setActiveWorkspace: (id: string | null) => void;
  setLocale: (locale: SupportedLocale) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  toggleBuiltinPlatform: (id: string) => void;
  toggleCustomPlatform: (id: string) => void;
  openSettings: (section?: string) => void;
  closeSettings: () => void;
  savePublicationTemplate: (tpl: Omit<PublicationTemplate, 'id'>) => PublicationTemplate;
  removePublicationTemplate: (id: string) => void;
  savePlatformBundle: (bundle: Omit<PlatformBundle, 'id'>) => PlatformBundle;
  removePlatformBundle: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      locale: 'en-US',
      sidebarCollapsed: false,
      theme: 'system',
      disabledBuiltinPlatforms: [],
      disabledCustomPlatforms: [],
      publicationTemplates: [],
      platformBundles: [],
      settingsSection: null,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      toggleBuiltinPlatform: (id) =>
        set((s) => ({
          disabledBuiltinPlatforms: s.disabledBuiltinPlatforms.includes(id)
            ? s.disabledBuiltinPlatforms.filter((p) => p !== id)
            : [...s.disabledBuiltinPlatforms, id],
        })),
      toggleCustomPlatform: (id) =>
        set((s) => ({
          disabledCustomPlatforms: s.disabledCustomPlatforms.includes(id)
            ? s.disabledCustomPlatforms.filter((p) => p !== id)
            : [...s.disabledCustomPlatforms, id],
        })),
      openSettings: (section = 'account') => set({ settingsSection: section }),
      closeSettings: () => set({ settingsSection: null }),
      savePublicationTemplate: (tpl) => {
        const newTpl: PublicationTemplate = { id: `tpl_${Date.now()}`, ...tpl };
        set((s) => ({ publicationTemplates: [...s.publicationTemplates, newTpl] }));
        return newTpl;
      },
      removePublicationTemplate: (id) =>
        set((s) => ({ publicationTemplates: s.publicationTemplates.filter((t) => t.id !== id) })),
      savePlatformBundle: (bundle) => {
        const newBundle: PlatformBundle = { id: `bundle_${Date.now()}`, ...bundle };
        set((s) => ({ platformBundles: [...s.platformBundles, newBundle] }));
        return newBundle;
      },
      removePlatformBundle: (id) =>
        set((s) => ({ platformBundles: s.platformBundles.filter((b) => b.id !== id) })),
    }),
    { name: 'contentflow-ui' }
  )
);
