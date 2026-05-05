import { Queue } from 'bullmq';
import { bullmqConnection } from './client';

export const notificationQueue = new Queue('notifications', { connection: bullmqConnection });

export const publishingQueue = new Queue('publishing', { connection: bullmqConnection });

export interface PublishingJobData {
  uploadJobId: string;
}
