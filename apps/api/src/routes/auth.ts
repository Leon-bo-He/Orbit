import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema/index';
import { redis } from '../redis/client';
import { config } from '../config';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: false, // set true in production
  sameSite: 'strict' as const,
  path: '/api/auth',
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>('/api/auth/login', async (req, reply) => {
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
        user: { id: user.id, email: user.email, name: user.name, locale: user.locale },
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
      return reply.send({ accessToken });
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
};
