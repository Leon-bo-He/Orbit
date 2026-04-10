import { Worker } from 'bullmq';
import { bullmqConnection } from './client.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { sendMessage } from '../lib/telegram.js';

export function startWorkers() {
  const notificationWorker = new Worker(
    'notifications',
    async (job) => {
      if (job.name === 'publish_reminder') {
        const { userId, contentTitle, scheduledAt, platform } = job.data as {
          userId: string;
          contentTitle: string;
          scheduledAt: string;
          platform?: string;
        };

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.telegramBotToken || !user.telegramChatId) return;

        const when = new Date(scheduledAt).toLocaleString(user.locale ?? 'en-US', {
          timeZone: user.timezone ?? 'UTC',
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        const platformLine = platform ? `\n📡 Platform: <b>${platform}</b>` : '';

        await sendMessage(
          user.telegramBotToken,
          user.telegramChatId,
          `🔔 <b>Orbit publish reminder</b>\n\n📝 ${contentTitle}${platformLine}\n🕐 Scheduled: ${when}`,
        );
      }
    },
    { connection: bullmqConnection },
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });
}
