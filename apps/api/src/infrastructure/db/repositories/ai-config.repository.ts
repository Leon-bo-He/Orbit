import { eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { aiConfigs } from '../../../db/schema/ai-configs.js';
import type { AiConfigRow } from '../../../db/schema/ai-configs.js';

export class AiConfigRepository {
  async findByUser(userId: string): Promise<AiConfigRow | null> {
    const [row] = await db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId));
    return row ?? null;
  }

  async upsert(userId: string, data: { baseUrl: string; apiKey?: string; model: string }): Promise<void> {
    if (data.apiKey) {
      await db.insert(aiConfigs)
        .values({ userId, baseUrl: data.baseUrl, apiKey: data.apiKey, model: data.model, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: aiConfigs.userId,
          set: { baseUrl: data.baseUrl, apiKey: data.apiKey, model: data.model, updatedAt: new Date() },
        });
    } else {
      // Update without touching the stored API key
      await db.update(aiConfigs)
        .set({ baseUrl: data.baseUrl, model: data.model, updatedAt: new Date() })
        .where(eq(aiConfigs.userId, userId));
    }
  }
}
