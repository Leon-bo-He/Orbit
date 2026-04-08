import { z } from 'zod';

const contentTypeValues = [
  'video_short', 'video_long', 'image_text', 'article', 'podcast', 'live',
] as const;

const stageValues = [
  'planned', 'planning', 'creating', 'ready', 'publishing', 'published', 'reviewed', 'archived',
] as const;

export const createContentSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(500),
  contentType: z.enum(contentTypeValues),
  ideaId: z.string().uuid().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  targetPlatforms: z.array(z.string()).default([]),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const updateContentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  contentType: z.enum(contentTypeValues).optional(),
  stage: z.enum(stageValues).optional(),
  tags: z.array(z.string()).optional(),
  targetPlatforms: z.array(z.string()).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  stageHistory: z.array(z.object({ stage: z.string(), timestamp: z.string() })).optional(),
});
