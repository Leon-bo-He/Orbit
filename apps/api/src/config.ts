import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_APP_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RUNNER_URL: z.string().default('http://localhost:4000'),
  RUNNER_TOKEN: z.string().min(16).optional(),
  STORAGE_STATE_ENCRYPTION_KEY: z.string().optional(),
  RUNNER_MAX_BROWSERS: z.coerce.number().int().positive().default(4),
  PUBLISHING_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  PUBLISHING_HEADED: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  PUBLISHING_UPLOAD_DIR: z.string().default('/shared/uploads'),
});

const _parsed = envSchema.safeParse(process.env);
if (!_parsed.success) {
  console.error('Invalid environment variables:', _parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = _parsed.data;
export type Config = typeof config;
