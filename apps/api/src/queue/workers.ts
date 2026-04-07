import { Worker } from 'bullmq';
import { bullmqConnection } from './client';

export function startWorkers() {
  const notificationWorker = new Worker(
    'notifications',
    async (job) => {
      // TODO W9-10: handle publish reminders
      console.log('Notification job:', job.name, job.data);
    },
    { connection: bullmqConnection }
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });
}
