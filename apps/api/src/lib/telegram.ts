/**
 * Minimal Telegram Bot API wrapper using native fetch (Node 18+).
 * Only the operations needed for push notifications.
 */

const BASE = 'https://api.telegram.org';

interface TelegramResult<T> {
  ok: boolean;
  description?: string;
  result?: T;
}

async function tgFetch<T>(token: string, method: string, body?: Record<string, unknown>): Promise<TelegramResult<T>> {
  const res = await fetch(`${BASE}/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<TelegramResult<T>>;
}

/** Send a text message. Returns ok:true on success. */
export async function sendMessage(token: string, chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const result = await tgFetch(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
  return { ok: result.ok, error: result.description };
}

/** Validate that a token is a real bot by calling getMe. */
export async function validateToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const result = await tgFetch(token, 'getMe');
  return { ok: result.ok, error: result.description };
}
