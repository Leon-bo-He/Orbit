import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserService } from '../../../domain/user/user.service.js';
import { sendMessage, validateToken, getLatestChatId } from '../../../lib/telegram.js';

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
      // undefined = don't change; null = clear; string = update
      botToken: z.string().min(1).nullable().optional(),
      chatId: z.string().min(1).nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });

    const { botToken, chatId } = parsed.data;
    const { sub } = req.user as { sub: string };

    // Only validate the token if a new one was explicitly provided
    if (botToken) {
      const check = await validateToken(botToken);
      if (!check.ok) return reply.code(400).send({ error: `Invalid bot token: ${check.error ?? 'unknown error'}` });
    }

    const payload: Parameters<typeof svc.update>[1] = { telegramChatId: chatId };
    if (botToken !== undefined) payload.telegramBotToken = botToken;

    const updated = await svc.update(sub, payload);
    if (!updated) return reply.code(404).send({ error: 'User not found' });

    return reply.send({
      configured: !!(updated.telegramBotToken && updated.telegramChatId),
      chatId: updated.telegramChatId ?? null,
      tokenSet: !!updated.telegramBotToken,
    });
  });

  // POST /api/notifications/telegram/fetch-chat-id — call getUpdates to auto-detect chat id
  app.post<{ Body: unknown }>('/api/notifications/telegram/fetch-chat-id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ botToken: z.string().min(1).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

    const { sub } = req.user as { sub: string };

    // Use token from request body if provided; fall back to stored token
    let token = parsed.data.botToken;
    if (!token) {
      const user = await svc.findById(sub);
      token = user?.telegramBotToken ?? undefined;
    }
    if (!token) return reply.code(400).send({ error: 'No bot token provided or saved' });

    const result = await getLatestChatId(token);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return reply.send({ chatId: result.chatId });
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
