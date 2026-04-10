import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserService } from '../../../domain/user/user.service.js';
import type { NotificationChannelService } from '../../../domain/notification-channel/notification-channel.service.js';
import { sendMessage, validateToken, getLatestChatId } from '../../../lib/telegram.js';
import { getTelegramMessages } from '../../../lib/telegram-messages.js';

type TelegramConfig = { botToken?: string | null; chatId?: string | null };

function toResponse(channel: { enabled: boolean; config: Record<string, unknown> } | null, leadTime: number) {
  const cfg = (channel?.config ?? {}) as TelegramConfig;
  return {
    configured: !!(cfg.botToken && cfg.chatId),
    chatId: cfg.chatId ?? null,
    tokenSet: !!cfg.botToken,
    enabled: channel?.enabled ?? true,
    leadTime,
  };
}

export function notificationsRoutes(app: FastifyInstance, svc: UserService, channelSvc: NotificationChannelService) {
  // GET /api/notifications/telegram
  app.get('/api/notifications/telegram', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const [user, channel] = await Promise.all([
      svc.findById(sub),
      channelSvc.findByUserAndType(sub, 'telegram'),
    ]);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send(toResponse(channel, user.notificationLeadTime));
  });

  // PATCH /api/notifications/telegram — update config, toggle, or lead time
  app.patch<{ Body: unknown }>('/api/notifications/telegram', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      botToken: z.string().min(1).nullable().optional(),
      chatId: z.string().min(1).nullable().optional(),
      enabled: z.boolean().optional(),
      leadTime: z.number().int().min(1).max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });

    const { botToken, chatId, enabled, leadTime } = parsed.data;
    const { sub } = req.user as { sub: string };

    // Validate new token before saving
    if (botToken) {
      const check = await validateToken(botToken);
      if (!check.ok) return reply.code(400).send({ error: `Invalid bot token: ${check.error ?? 'unknown error'}` });
    }

    // Disconnect: both explicitly null → delete the channel row
    if (botToken === null && chatId === null) {
      await channelSvc.delete(sub, 'telegram');
      const user = await svc.findById(sub);
      return reply.send(toResponse(null, user?.notificationLeadTime ?? 15));
    }

    // Build the config update
    const updates: Record<string, unknown> = {};
    const existing = await channelSvc.findByUserAndType(sub, 'telegram');
    const currentConfig = (existing?.config ?? {}) as TelegramConfig;

    if (botToken !== undefined) updates.botToken = botToken;
    if (chatId !== undefined) updates.chatId = chatId;

    const newConfig = Object.keys(updates).length > 0
      ? { ...currentConfig, ...updates }
      : undefined;

    const [channel, user] = await Promise.all([
      (newConfig !== undefined || enabled !== undefined)
        ? channelSvc.upsert(sub, 'telegram', { config: newConfig, enabled })
        : channelSvc.findByUserAndType(sub, 'telegram'),
      leadTime !== undefined
        ? svc.update(sub, { notificationLeadTime: leadTime })
        : svc.findById(sub),
    ]);

    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send(toResponse(channel, user.notificationLeadTime));
  });

  // POST /api/notifications/telegram/fetch-chat-id
  app.post<{ Body: unknown }>('/api/notifications/telegram/fetch-chat-id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ botToken: z.string().min(1).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

    const { sub } = req.user as { sub: string };

    let token = parsed.data.botToken;
    if (!token) {
      const channel = await channelSvc.findByUserAndType(sub, 'telegram');
      token = (channel?.config as TelegramConfig)?.botToken ?? undefined;
    }
    if (!token) return reply.code(400).send({ error: 'No bot token provided or saved' });

    const result = await getLatestChatId(token);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return reply.send({ chatId: result.chatId });
  });

  // POST /api/notifications/telegram/test
  app.post('/api/notifications/telegram/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const [user, channel] = await Promise.all([
      svc.findById(sub),
      channelSvc.findByUserAndType(sub, 'telegram'),
    ]);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const cfg = (channel?.config ?? {}) as TelegramConfig;
    if (!cfg.botToken || !cfg.chatId) {
      return reply.code(400).send({ error: 'Telegram is not configured' });
    }

    const msg = getTelegramMessages(user.locale);
    const result = await sendMessage(cfg.botToken, cfg.chatId, msg.test);
    if (!result.ok) {
      console.error('[telegram/test] sendMessage failed:', result.error);
      return reply.code(502).send({ error: result.error ?? 'Failed to send message' });
    }
    return reply.send({ ok: true });
  });
}
