import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export type BriefSection = 'audience' | 'goals' | 'hooks' | 'titles' | 'outline';

export interface BriefContext {
  contentTitle: string;
  contentType: string;
  platform?: string;
  audience?: string;
  goals?: string[];
  hooks?: string;
  outline?: string;
  additionalRequirements?: string;
}

export function useGenerateBriefSection() {
  return useMutation<{ result: unknown }, Error, { section: BriefSection; context: Partial<BriefContext> }>({
    mutationFn: (body) =>
      apiFetch<{ result: unknown }>('/api/ai-brief', { method: 'POST', body: JSON.stringify(body) }),
  });
}
