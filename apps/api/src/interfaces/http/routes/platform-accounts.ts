import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PlatformAccountService } from '../../../domain/platform-account/platform-account.service.js';

const platformEnum = z.enum([
  'douyin',
  'rednote',
  'wechat_video',
  'bilibili',
  'tiktok',
  'youtube',
  'instagram',
  'facebook',
  'x',
]);

const cookiesSchema = z.union([z.string().min(1), z.array(z.unknown()), z.object({}).passthrough()]);

const createSchema = z.object({
  platform: platformEnum,
  accountName: z.string().min(1).max(120),
  displayName: z.string().max(160).nullable().optional(),
  cookies: cookiesSchema,
});

const updateCookiesSchema = z.object({ cookies: cookiesSchema });

const renameSchema = z.object({
  accountName: z.string().min(1).max(120).optional(),
  displayName: z.string().max(160).nullable().optional(),
});

export function platformAccountsRoutes(app: FastifyInstance, svc: PlatformAccountService) {
  app.get('/api/platform-accounts', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { platform } = req.query as { platform?: string };
    const platformFilter = platform && platformEnum.options.includes(platform as never) ? platform : undefined;
    return reply.send(await svc.list(sub, platformFilter));
  });

  app.post('/api/platform-accounts', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = createSchema.parse(req.body);
    const args: Parameters<typeof svc.create>[1] = {
      platform: body.platform,
      accountName: body.accountName,
      cookies: body.cookies,
    };
    if (body.displayName !== undefined) args.displayName = body.displayName;
    const result = await svc.create(sub, args);
    return reply.code(201).send(result);
  });

  app.post(
    '/api/platform-accounts/:id/check',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user as { sub: string };
      const { id } = req.params as { id: string };
      const result = await svc.revalidate(sub, id);
      return reply.send(result);
    },
  );

  app.patch(
    '/api/platform-accounts/:id/cookies',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user as { sub: string };
      const { id } = req.params as { id: string };
      const body = updateCookiesSchema.parse(req.body);
      const result = await svc.replaceCookies(sub, id, body.cookies);
      return reply.send(result);
    },
  );

  app.patch('/api/platform-accounts/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = renameSchema.parse(req.body);
    const args: Parameters<typeof svc.rename>[2] = {};
    if (body.accountName !== undefined) args.accountName = body.accountName;
    if (body.displayName !== undefined) args.displayName = body.displayName;
    return reply.send(await svc.rename(sub, id, args));
  });

  app.delete('/api/platform-accounts/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await svc.delete(sub, id);
    return reply.code(204).send();
  });
}
