import { z } from 'zod';

const platformSettingsSchema = z.object({
  visibility: z.enum(['public', 'private', 'friends']).optional(),
  allowComments: z.boolean().optional(),
  location: z.string().optional(),
  collection: z.string().optional(),
}).passthrough();

export const createPublicationSchema = z.object({
  platform: z.string().min(1),
  platformTitle: z.string().optional(),
  platformCopy: z.string().optional(),
  platformTags: z.array(z.string()).default([]),
  coverUrl: z.string().url().optional(),
  platformSettings: platformSettingsSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const updatePublicationSchema = z.object({
  platformTitle: z.string().nullable().optional(),
  platformCopy: z.string().nullable().optional(),
  platformTags: z.array(z.string()).optional(),
  coverUrl: z.string().url().nullable().optional(),
  platformSettings: platformSettingsSchema.optional(),
  platformAccountId: z.string().uuid().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  status: z.enum(['draft', 'queued', 'ready', 'posting', 'published', 'failed', 'skipped']).optional(),
});

export const markPublishedSchema = z.object({
  platformUrl: z.string().url(),
  platformPostId: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
});

export const batchUpdatePublicationsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  scheduledAt: z.coerce.date().optional(),
  status: z.enum(['draft', 'queued', 'ready', 'skipped']).optional(),
});
