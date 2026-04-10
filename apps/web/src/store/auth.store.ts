import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAccessToken } from '../api/client.js';
import { useUiStore } from './ui.store.js';
import { queryClient } from '../api/query-client.js';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  locale: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) => {
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      clearAuth: () => {
        setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
        useUiStore.getState().setActiveWorkspace(null);
        queryClient.clear();
      },
    }),
    {
      name: 'orbit-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) setAccessToken(state.accessToken);
      },
      storage: {
        getItem: (name) => {
          const val = sessionStorage.getItem(name);
          return val ? (JSON.parse(val) as ReturnType<typeof JSON.parse>) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
    }
  )
);
