import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserService } from '../../../domain/user/user.service.js';
import { sendMessage, validateToken } from '../../../lib/telegram.js';

export function notificationsRoutes(app: FastifyInstance, svc: UserService) {
  // GET /api/notifications/telegram — return masked config (never expose the token)
  app.get('/api/notifications/telegram', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const user = await svc.findById(sub);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    return reply.send({
      configured: !!(user.telegramBotToken && user.telegramChatId),
      chatId: user.telegramChatId ?? null,
      // token is never returned — client only knows whether it's set
      tokenSet: !!user.telegramBotToken,
    });
  });

  // PATCH /api/notifications/telegram — save or clear Telegram config
  app.patch<{ Body: unknown }>('/api/notifications/telegram', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      botToken: z.string().min(1).nullable(),
      chatId: z.string().min(1).nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });

    const { botToken, chatId } = parsed.data;
    const { sub } = req.user as { sub: string };

    // If setting a new token, validate it against Telegram before saving
    if (botToken) {
      const check = await validateToken(botToken);
      if (!check.ok) return reply.code(400).send({ error: `Invalid bot token: ${check.error ?? 'unknown error'}` });
    }

    const updated = await svc.update(sub, {
      telegramBotToken: botToken,
      telegramChatId: chatId,
    });
    if (!updated) return reply.code(404).send({ error: 'User not found' });

    return reply.send({
      configured: !!(updated.telegramBotToken && updated.telegramChatId),
      chatId: updated.telegramChatId ?? null,
      tokenSet: !!updated.telegramBotToken,
    });
  });

  // POST /api/notifications/telegram/test — send a test message with stored credentials
  app.post('/api/notifications/telegram/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const user = await svc.findById(sub);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    if (!user.telegramBotToken || !user.telegramChatId) {
      return reply.code(400).send({ error: 'Telegram is not configured' });
    }

    const result = await sendMessage(
      user.telegramBotToken,
      user.telegramChatId,
      '✅ <b>Orbit</b> — Telegram notifications are working!',
    );

    if (!result.ok) {
      console.error('[telegram/test] sendMessage failed:', result.error);
      return reply.code(502).send({ error: result.error ?? 'Failed to send message' });
    }

    return reply.send({ ok: true });
  });
}
