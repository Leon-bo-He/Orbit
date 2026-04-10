import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { redis } from '../../../redis/client.js';
import { config } from '../../../config.js';
import type { UserService } from '../../../domain/user/user.service.js';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1).max(100),
  password: z.string().min(8),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict' as const,
  path: '/api/auth',
};

export function authRoutes(app: FastifyInstance, svc: UserService) {
  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, onRequest: [] },
    async (req, reply) => {
      const { email, password } = req.body;
      let user: Awaited<ReturnType<UserService['findByEmail']>>;
      try {
        user = await svc.findByEmail(email);
      } catch (err) {
        req.log.error(err, 'Database error during login');
        return reply.code(503).send({ error: 'Service temporarily unavailable' });
      }
      if (!user?.passwordHash) return reply.code(401).send({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

      const jti = randomUUID();
      const accessToken = app.jwt.sign({ sub: user.id, email: user.email, jti }, { expiresIn: config.JWT_ACCESS_TTL });
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh', jti }, { expiresIn: config.JWT_REFRESH_TTL });
      await redis.setex(`session:${user.id}:${jti}`, config.JWT_REFRESH_TTL, '1');

      return reply
        .setCookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: config.JWT_REFRESH_TTL })
        .send({ accessToken, user: { id: user.id, email: user.email, username: user.username, locale: user.locale } });
    },
  );

  // POST /api/auth/refresh
  app.post('/api/auth/refresh', async (req, reply) => {
    const token = req.cookies['refreshToken'];
    if (!token) return reply.code(401).send({ error: 'No refresh token' });
    try {
      const payload = app.jwt.verify<{ sub: string; jti: string; type: string }>(token);
      if (payload.type !== 'refresh') return reply.code(401).send({ error: 'Invalid token type' });
      const sessionKey = `session:${payload.sub}:${payload.jti}`;
      if (!(await redis.exists(sessionKey))) return reply.code(401).send({ error: 'Session expired' });

      const newJti = randomUUID();
      await redis.del(sessionKey);
      await redis.setex(`session:${payload.sub}:${newJti}`, config.JWT_REFRESH_TTL, '1');
      const accessToken = app.jwt.sign({ sub: payload.sub, jti: newJti }, { expiresIn: config.JWT_ACCESS_TTL });
      const newRefreshToken = app.jwt.sign({ sub: payload.sub, type: 'refresh', jti: newJti }, { expiresIn: config.JWT_REFRESH_TTL });

      return reply
        .setCookie('refreshToken', newRefreshToken, { ...COOKIE_OPTS, maxAge: config.JWT_REFRESH_TTL })
        .send({ accessToken });
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, jti } = req.user as { sub: string; jti: string };
    await redis.del(`session:${sub}:${jti}`);
    return reply.clearCookie('refreshToken', { path: '/api/auth' }).send({ ok: true });
  });

  // POST /api/auth/register
  app.post<{ Body: unknown }>('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
    }
    const { email, username, password } = parsed.data;

    const existing = await svc.findByEmail(email);
    if (existing) return reply.code(409).send({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await svc.create({ email, username, passwordHash });

    const jti = randomUUID();
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email, jti }, { expiresIn: config.JWT_ACCESS_TTL });
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh', jti }, { expiresIn: config.JWT_REFRESH_TTL });
    await redis.setex(`session:${user.id}:${jti}`, config.JWT_REFRESH_TTL, '1');

    return reply.code(201)
      .setCookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: config.JWT_REFRESH_TTL })
      .send({ accessToken, user: { id: user.id, email: user.email, username: user.username, locale: user.locale } });
  });

  // PATCH /api/auth/profile
  app.patch<{ Body: unknown }>('/api/auth/profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      username: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      locale: z.string().optional(),
      timezone: z.string().optional(),
    }).refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'At least one field required' });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });

    const { sub } = req.user as { sub: string };
    const updates = parsed.data;

    if (updates.email) {
      const conflict = await svc.findByEmail(updates.email);
      if (conflict && conflict.id !== sub) return reply.code(409).send({ error: 'Email already in use' });
    }

    const updatePayload: Parameters<UserService['update']>[1] = {};
    if (updates.username !== undefined) updatePayload.username = updates.username;
    if (updates.email !== undefined) updatePayload.email = updates.email;
    if (updates.locale !== undefined) updatePayload.locale = updates.locale;
    if (updates.timezone !== undefined) updatePayload.timezone = updates.timezone;
    const updated = await svc.update(sub, updatePayload);
    if (!updated) return reply.code(404).send({ error: 'User not found' });

    return reply.send({ id: updated.id, email: updated.email, username: updated.username, locale: updated.locale });
  });

  // PATCH /api/auth/password
  app.patch<{ Body: unknown }>('/api/auth/password', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });

    const { sub } = req.user as { sub: string };
    const user = await svc.findById(sub);
    if (!user?.passwordHash) return reply.code(404).send({ error: 'User not found' });

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Current password is incorrect' });

    await svc.updatePassword(sub, await bcrypt.hash(parsed.data.newPassword, 10));
    return reply.send({ ok: true });
  });

  // DELETE /api/auth/account
  app.delete('/api/auth/account', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ password: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Password required' });

    const { sub, jti } = req.user as { sub: string; jti: string };
    const user = await svc.findById(sub);
    if (!user?.passwordHash) return reply.code(404).send({ error: 'User not found' });

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Incorrect password' });

    await redis.del(`session:${sub}:${jti}`);
    await svc.delete(sub);
    return reply.clearCookie('refreshToken', { path: '/api/auth' }).send({ ok: true });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const user = await svc.findById(sub);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ id: user.id, email: user.email, username: user.username, locale: user.locale, timezone: user.timezone });
  });
}
