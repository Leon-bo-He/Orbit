import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RssSource {
  id: string;
  name: string;
  url: string;
}

interface RssState {
  sources: RssSource[];
  addSource: (source: Omit<RssSource, 'id'>) => void;
  removeSource: (id: string) => void;
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
    }),
    { name: 'orbit-rss' }
  )
);
