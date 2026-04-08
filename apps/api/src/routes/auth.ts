import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { users } from '../db/schema/index';
import { redis } from '../redis/client';
import { config } from '../config';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: false, // set true in production
  sameSite: 'strict' as const,
  path: '/api/auth',
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    onRequest: [],
  }, async (req, reply) => {
    const { email, password } = req.body;
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user?.passwordHash) return reply.code(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const jti = randomUUID();
    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email, jti },
      { expiresIn: config.JWT_ACCESS_TTL }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh', jti },
      { expiresIn: config.JWT_REFRESH_TTL }
    );

    await redis.setex(`session:${user.id}:${jti}`, config.JWT_REFRESH_TTL, '1');

    return reply
      .setCookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: config.JWT_REFRESH_TTL })
      .send({
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, locale: user.locale, appearance: user.appearance },
      });
  });

  // POST /api/auth/refresh
  app.post('/api/auth/refresh', async (req, reply) => {
    const token = req.cookies['refreshToken'];
    if (!token) return reply.code(401).send({ error: 'No refresh token' });
    try {
      const payload = app.jwt.verify<{ sub: string; jti: string; type: string }>(token);
      if (payload.type !== 'refresh') return reply.code(401).send({ error: 'Invalid token type' });

      const sessionKey = `session:${payload.sub}:${payload.jti}`;
      const exists = await redis.exists(sessionKey);
      if (!exists) return reply.code(401).send({ error: 'Session expired' });

      // Rotate session
      const newJti = randomUUID();
      await redis.del(sessionKey);
      await redis.setex(`session:${payload.sub}:${newJti}`, config.JWT_REFRESH_TTL, '1');

      const accessToken = app.jwt.sign(
        { sub: payload.sub, jti: newJti },
        { expiresIn: config.JWT_ACCESS_TTL }
      );
      const newRefreshToken = app.jwt.sign(
        { sub: payload.sub, type: 'refresh', jti: newJti },
        { expiresIn: config.JWT_REFRESH_TTL }
      );
      return reply
        .setCookie('refreshToken', newRefreshToken, { ...COOKIE_OPTS, maxAge: config.JWT_REFRESH_TTL })
        .send({ accessToken });
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  // POST /api/auth/logout
  app.post(
    '/api/auth/logout',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const user = req.user as { sub: string; jti: string };
      await redis.del(`session:${user.sub}:${user.jti}`);
      return reply
        .clearCookie('refreshToken', { path: '/api/auth' })
        .send({ ok: true });
    }
  );

  // POST /api/auth/register
  app.post<{ Body: unknown }>('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
    }
    const { email, name, password } = parsed.data;

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash })
      .returning();

    if (!user) {
      return reply.code(500).send({ error: 'Failed to create user' });
    }

    const jti = randomUUID();
    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email, jti },
      { expiresIn: config.JWT_ACCESS_TTL }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh', jti },
      { expiresIn: config.JWT_REFRESH_TTL }
    );

    await redis.setex(`session:${user.id}:${jti}`, config.JWT_REFRESH_TTL, '1');

    return reply
      .code(201)
      .setCookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: config.JWT_REFRESH_TTL })
      .send({
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, locale: user.locale, appearance: user.appearance },
      });
  });

  // PATCH /api/auth/profile
  app.patch<{ Body: unknown }>(
    '/api/auth/profile',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const schema = z.object({
        name:       z.string().min(1).max(100).optional(),
        email:      z.string().email().optional(),
        locale:     z.string().optional(),
        timezone:   z.string().optional(),
        appearance: z.enum(['system', 'light', 'dark']).optional(),
      }).refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: 'At least one field required',
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
      }

      const { sub } = req.user as { sub: string };
      const updates = parsed.data;

      if (updates.email) {
        const [conflict] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, updates.email))
          .limit(1);
        if (conflict && conflict.id !== sub) {
          return reply.code(409).send({ error: 'Email already in use' });
        }
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, sub))
        .returning({ id: users.id, email: users.email, name: users.name, locale: users.locale, appearance: users.appearance });

      if (!updated) return reply.code(404).send({ error: 'User not found' });
      return reply.send(updated);
    }
  );

  // PATCH /api/auth/password
  app.patch<{ Body: unknown }>(
    '/api/auth/password',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
      }

      const { sub } = req.user as { sub: string };
      const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1);
      if (!user?.passwordHash) return reply.code(404).send({ error: 'User not found' });

      const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
      if (!valid) return reply.code(401).send({ error: 'Current password is incorrect' });

      const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, sub));

      return reply.send({ ok: true });
    }
  );

  // DELETE /api/auth/account
  app.delete(
    '/api/auth/account',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const schema = z.object({ password: z.string().min(1) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Password required' });
      }

      const { sub, jti } = req.user as { sub: string; jti: string };
      const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1);
      if (!user?.passwordHash) return reply.code(404).send({ error: 'User not found' });

      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) return reply.code(401).send({ error: 'Incorrect password' });

      // Revoke session, then delete user
      await redis.del(`session:${sub}:${jti}`);
      await db.delete(users).where(eq(users.id, sub));

      return reply
        .clearCookie('refreshToken', { path: '/api/auth' })
        .send({ ok: true });
    }
  );

  // GET /api/auth/me
  app.get(
    '/api/auth/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user as { sub: string };
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, locale: users.locale, timezone: users.timezone, appearance: users.appearance })
        .from(users)
        .where(eq(users.id, sub))
        .limit(1);
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return reply.send(user);
    }
  );
};
