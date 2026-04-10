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

/** Fetch the most recent chat ID from getUpdates (user must have sent the bot a message first). */
export async function getLatestChatId(token: string): Promise<{ ok: boolean; chatId?: string; error?: string }> {
  type Update = { message?: { chat: { id: number } }; channel_post?: { chat: { id: number } } };
  const result = await tgFetch<Update[]>(token, 'getUpdates');
  if (!result.ok) return { ok: false, error: result.description };

  const updates = result.result ?? [];
  if (!updates.length) {
    return { ok: false, error: 'No messages found. Send any message to your bot first, then try again.' };
  }

  // Walk from newest to oldest and return the first chat id we find
  for (let i = updates.length - 1; i >= 0; i--) {
    const id = updates[i]?.message?.chat?.id ?? updates[i]?.channel_post?.chat?.id;
    if (id !== undefined) return { ok: true, chatId: String(id) };
  }
  return { ok: false, error: 'No chat found in recent updates. Send a message to your bot and try again.' };
}
