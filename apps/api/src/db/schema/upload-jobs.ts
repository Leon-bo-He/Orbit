import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { publications } from './publications';
import { platformAccounts } from './platform-accounts';

export const uploadJobs = pgTable('upload_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicationId: uuid('publication_id')
    .notNull()
    .references(() => publications.id, { onDelete: 'cascade' }),
  platformAccountId: uuid('platform_account_id').references(() => platformAccounts.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull().default('queued'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  attempt: integer('attempt').notNull().default(1),
  bullmqJobId: text('bullmq_job_id'),
  runnerJobId: text('runner_job_id'),
  resultUrl: text('result_url'),
  resultPostId: text('result_post_id'),
  failureReason: text('failure_reason'),
  logExcerpt: text('log_excerpt'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UploadJobRow = typeof uploadJobs.$inferSelect;
export type InsertUploadJob = typeof uploadJobs.$inferInsert;

export type UploadJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
