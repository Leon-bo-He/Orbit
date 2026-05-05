import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { platformAccounts } from '../../../db/schema/platform-accounts.js';
import type { IPlatformAccountRepository } from '../../../domain/platform-account/platform-account.service.js';
import type { CookieStatus } from '../../../db/schema/platform-accounts.js';

export class PlatformAccountRepository implements IPlatformAccountRepository {
  async create(data: {
    userId: string;
    platform: string;
    accountName: string;
    displayName?: string | null;
    storageStateEnc: string;
    cookieStatus: CookieStatus;
  }) {
    const [row] = await db.insert(platformAccounts).values(data).returning();
    return row!;
  }

  listByUser(userId: string, platform?: string) {
    const conditions = platform
      ? and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, platform))
      : eq(platformAccounts.userId, userId);
    return db
      .select()
      .from(platformAccounts)
      .where(conditions)
      .orderBy(desc(platformAccounts.createdAt));
  }

  async findById(id: string) {
    const [row] = await db.select().from(platformAccounts).where(eq(platformAccounts.id, id));
    return row ?? null;
  }

  async findByIdOwnedBy(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(platformAccounts)
      .where(and(eq(platformAccounts.id, id), eq(platformAccounts.userId, userId)));
    return row ?? null;
  }

  async update(id: string, data: Partial<typeof platformAccounts.$inferInsert>) {
    const [row] = await db
      .update(platformAccounts)
      .set(data)
      .where(eq(platformAccounts.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string) {
    await db.delete(platformAccounts).where(eq(platformAccounts.id, id));
  }
}
