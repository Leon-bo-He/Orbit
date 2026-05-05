import { Worker } from 'bullmq';
import { bullmqConnection } from './client.js';
import { db } from '../db/client.js';
import { users, notificationChannels } from '../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { sendMessage } from '../lib/telegram.js';
import { getTelegramMessages } from '../lib/telegram-messages.js';
import { startPublishingWorker } from './publishing-dispatcher.js';

export function startWorkers() {
  startPublishingWorker();

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
        if (!user) return;

        const [channel] = await db
          .select()
          .from(notificationChannels)
          .where(and(eq(notificationChannels.userId, userId), eq(notificationChannels.type, 'telegram')))
          .limit(1);

        if (!channel?.enabled) return;

        const { botToken, chatId } = (channel.config ?? {}) as { botToken?: string; chatId?: string };
        if (!botToken || !chatId) return;

        const when = new Date(scheduledAt).toLocaleString(user.locale ?? 'en-US', {
          timeZone: user.timezone ?? 'UTC',
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        const msg = getTelegramMessages(user.locale);
        const platformLine = platform ? `\n${msg.reminderPlatform}: <b>${platform}</b>` : '';

        await sendMessage(
          botToken,
          chatId,
          `${msg.reminderTitle}\n\n📝 ${contentTitle}${platformLine}\n${msg.reminderScheduled}: ${when}`,
        );
      }
    },
    { connection: bullmqConnection },
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });
}
