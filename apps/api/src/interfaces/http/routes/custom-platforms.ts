import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { customPlatforms } from '../../../db/schema/custom-platforms.js';

export function customPlatformsRoutes(app: FastifyInstance) {
  app.get('/api/custom-platforms', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    return reply.send(await db.select().from(customPlatforms).where(eq(customPlatforms.userId, sub)).orderBy(customPlatforms.createdAt));
  });

  app.post('/api/custom-platforms', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { name, icon } = req.body as { name?: string; icon?: string };
    if (!name?.trim()) return reply.code(400).send({ error: 'Name required' });
    const id = `custom_${Date.now()}`;
    const [row] = await db.insert(customPlatforms).values({ id, userId: sub, name: name.trim(), icon: icon || '📌' }).returning();
    return reply.code(201).send(row);
  });

  app.delete('/api/custom-platforms/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await db.delete(customPlatforms).where(and(eq(customPlatforms.id, id), eq(customPlatforms.userId, sub)));
    return reply.code(204).send();
  });
}
