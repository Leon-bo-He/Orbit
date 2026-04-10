import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export interface AuthResult {
  token: string;
  userId: string;
  email: string;
}

let _seq = 0;

export async function registerAndLogin(
  app: FastifyInstance,
  overrides?: { email?: string; password?: string; username?: string },
): Promise<AuthResult> {
  const seq = ++_seq;
  const email = overrides?.email ?? `user${seq}@test.com`;
  const password = overrides?.password ?? 'password123';
  const username = overrides?.username ?? 'Test User';

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, username, password },
  });

  if (res.statusCode !== 201) {
    throw new Error(`Registration failed (${res.statusCode}): ${res.body}`);
  }

  const body = res.json<{ accessToken: string; user: { id: string } }>();
  return { token: body.accessToken, userId: body.user.id, email };
}

export function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}
