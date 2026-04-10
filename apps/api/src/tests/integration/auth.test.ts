import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, authHeaders } from '../helpers/app.js';
import { truncateAll } from '../helpers/db.js';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await truncateAll(); });

  const register = (email: string, password = 'password123', username = 'Test User') =>
    app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password, username } });

  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });

  describe('POST /api/auth/register', () => {
    it('creates user and returns access token', async () => {
      const res = await register('alice@example.com');
      expect(res.statusCode).toBe(201);
      const body = res.json<{ accessToken: string; user: { email: string } }>();
      expect(body.accessToken).toBeTruthy();
      expect(body.user.email).toBe('alice@example.com');
    });

    it('returns 409 when email already registered', async () => {
      await register('alice@example.com');
      const res = await register('alice@example.com');
      expect(res.statusCode).toBe(409);
    });

    it('returns 400 for invalid email', async () => {
      const res = await register('not-an-email');
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for short password', async () => {
      const res = await register('alice@example.com', 'short');
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns access token for valid credentials', async () => {
      await register('alice@example.com');
      const res = await login('alice@example.com', 'password123');
      expect(res.statusCode).toBe(200);
      const body = res.json<{ accessToken: string }>();
      expect(body.accessToken).toBeTruthy();
    });

    it('returns 401 for wrong password', async () => {
      await register('alice@example.com');
      const res = await login('alice@example.com', 'wrongpassword');
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await login('nobody@example.com', 'password123');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile with valid token', async () => {
      const reg = await register('alice@example.com');
      const token = reg.json<{ accessToken: string }>().accessToken;
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: authHeaders(token) });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ email: string }>();
      expect(body.email).toBe('alice@example.com');
    });

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('issues new access token using refresh token cookie', async () => {
      const reg = await register('alice@example.com');
      const cookie = reg.headers['set-cookie'] as string;
      const refreshToken = cookie.match(/refreshToken=([^;]+)/)?.[1];
      expect(refreshToken).toBeTruthy();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refreshToken: refreshToken! },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ accessToken: string }>().accessToken).toBeTruthy();
    });

    it('returns 401 without cookie', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('invalidates session and returns ok', async () => {
      const reg = await register('alice@example.com');
      const token = reg.json<{ accessToken: string }>().accessToken;
      const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: authHeaders(token) });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ ok: boolean }>().ok).toBe(true);
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('updates username', async () => {
      const reg = await register('alice@example.com');
      const token = reg.json<{ accessToken: string }>().accessToken;
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        headers: authHeaders(token),
        payload: { username: 'Alice Updated' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ username: string }>().username).toBe('Alice Updated');
    });

    it('returns 409 when updating to already-used email', async () => {
      await register('bob@example.com');
      const aliceReg = await register('alice@example.com');
      const token = aliceReg.json<{ accessToken: string }>().accessToken;
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        headers: authHeaders(token),
        payload: { email: 'bob@example.com' },
      });
      expect(res.statusCode).toBe(409);
    });
  });
});
