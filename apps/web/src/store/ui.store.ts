import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedLocale } from '../i18n/index.js';

export type Theme = 'system' | 'light' | 'dark';

interface UiState {
  activeWorkspaceId: string | null;
  locale: SupportedLocale;
  sidebarCollapsed: boolean;
  theme: Theme;
  setActiveWorkspace: (id: string | null) => void;
  setLocale: (locale: SupportedLocale) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      locale: 'zh-CN',
      sidebarCollapsed: false,
      theme: 'system',
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'contentflow-ui' }
  )
);
