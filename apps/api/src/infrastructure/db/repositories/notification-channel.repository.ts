import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { notificationChannels } from '../../../db/schema/notification-channels.js';
import type { INotificationChannelRepository, NotificationChannel } from '../../../domain/notification-channel/notification-channel.service.js';

export class NotificationChannelRepository implements INotificationChannelRepository {
  async findByUserAndType(userId: string, type: string): Promise<NotificationChannel | null> {
    const [row] = await db
      .select()
      .from(notificationChannels)
      .where(and(eq(notificationChannels.userId, userId), eq(notificationChannels.type, type)))
      .limit(1);
    return (row as NotificationChannel) ?? null;
  }

  async upsert(
    userId: string,
    type: string,
    data: { config?: Record<string, unknown>; enabled?: boolean },
  ): Promise<NotificationChannel> {
    const existing = await this.findByUserAndType(userId, type);

    if (existing) {
      const [updated] = await db
        .update(notificationChannels)
        .set({
          ...(data.config !== undefined && { config: data.config }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          updatedAt: new Date(),
        })
        .where(and(eq(notificationChannels.userId, userId), eq(notificationChannels.type, type)))
        .returning();
      return updated as NotificationChannel;
    }

    const [created] = await db
      .insert(notificationChannels)
      .values({ userId, type, enabled: data.enabled ?? true, config: data.config ?? {} })
      .returning();
    return created as NotificationChannel;
  }

  async delete(userId: string, type: string): Promise<void> {
    await db
      .delete(notificationChannels)
      .where(and(eq(notificationChannels.userId, userId), eq(notificationChannels.type, type)));
  }
}
