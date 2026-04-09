import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customPlatforms } from '../db/schema/custom-platforms.js';

export const customPlatformsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/custom-platforms
  app.get('/api/custom-platforms', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const rows = await db
      .select()
      .from(customPlatforms)
      .where(eq(customPlatforms.userId, user.sub))
      .orderBy(customPlatforms.createdAt);
    return reply.send(rows);
  });

  // POST /api/custom-platforms
  app.post('/api/custom-platforms', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { name, icon } = req.body as { name?: string; icon?: string };
    if (!name?.trim()) return reply.code(400).send({ error: 'Name required' });
    const id = `custom_${Date.now()}`;
    const [row] = await db
      .insert(customPlatforms)
      .values({ id, userId: user.sub, name: name.trim(), icon: icon || '📌' })
      .returning();
    return reply.code(201).send(row);
  });

  // DELETE /api/custom-platforms/:id
  app.delete('/api/custom-platforms/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await db
      .delete(customPlatforms)
      .where(and(eq(customPlatforms.id, id), eq(customPlatforms.userId, user.sub)));
    return reply.code(204).send();
  });
};
