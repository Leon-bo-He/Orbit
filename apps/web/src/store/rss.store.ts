import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RssSource {
  id: string;
  name: string;
  url: string;
  folder?: string;
}

interface RssState {
  sources: RssSource[];
  addSource: (source: Omit<RssSource, 'id'>) => void;
  removeSource: (id: string) => void;
  updateSource: (id: string, patch: Partial<Omit<RssSource, 'id'>>) => void;
}

export const useRssStore = create<RssState>()(
  persist(
    (set) => ({
      sources: [],
      addSource: (source) => {
        const newSource: RssSource = { id: crypto.randomUUID(), ...source };
        set((s) => ({ sources: [...s.sources, newSource] }));
      },
      removeSource: (id) =>
        set((s) => ({ sources: s.sources.filter((src) => src.id !== id) })),
      updateSource: (id, patch) =>
        set((s) => ({
          sources: s.sources.map((src) => src.id === id ? { ...src, ...patch } : src),
        })),
    }),
    { name: 'orbit-rss' }
  )
);
