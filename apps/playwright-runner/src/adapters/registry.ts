import type { PublishAdapter } from './base.js';
import { DouyinAdapter } from './douyin.js';

const adapters: Map<string, PublishAdapter> = new Map();
adapters.set('douyin', new DouyinAdapter());

export function getAdapter(platform: string): PublishAdapter {
  const a = adapters.get(platform);
  if (!a) throw new Error(`No adapter registered for platform "${platform}". M1 ships with Douyin only.`);
  return a;
}

export function listAdapters(): string[] {
  return [...adapters.keys()];
}
