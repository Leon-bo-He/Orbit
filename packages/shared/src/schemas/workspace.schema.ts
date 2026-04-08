import { z } from 'zod';

const publishGoalSchema = z.object({
  count: z.number().int().positive(),
  period: z.enum(['day', 'week', 'month']),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().min(1).max(10),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  about: z.string().max(500).optional(),
  timezone: z.string().default('Asia/Shanghai'),
  publishGoal: publishGoalSchema.optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().min(1).max(10).optional(),
  about: z.string().max(500).optional(),
  publishGoal: publishGoalSchema.optional(),
  timezone: z.string().optional(),
  stageConfig: z
    .array(z.object({ id: z.string(), label: z.string(), order: z.number() }))
    .optional(),
});
