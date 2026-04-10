import { eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { users } from '../../../db/schema/users.js';
import type { IUserRepository } from '../../../domain/user/user.service.js';

export class UserRepository implements IUserRepository {
  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async create(data: { email: string; name: string; passwordHash: string }) {
    const [user] = await db.insert(users).values(data).returning();
    return user!;
  }

  async update(id: string, data: Partial<{ name: string; email: string; locale: string; timezone: string }>) {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated ?? null;
  }

  async updatePassword(id: string, passwordHash: string) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async delete(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }
}
