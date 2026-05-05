import { redis } from '../../redis/client';

const KEY_PREFIX = 'mutex:upload:account:';

/**
 * Acquire a per-account mutex. Returns the token to release with, or null if
 * already held. TTL must exceed the longest plausible job + a margin so that a
 * crashed worker eventually frees the slot.
 */
export async function acquireAccountMutex(
  platformAccountId: string,
  ttlMs: number,
): Promise<string | null> {
  const key = KEY_PREFIX + platformAccountId;
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
  return ok === 'OK' ? token : null;
}

/**
 * Release only if we still own the lock. Implemented with a Lua script for atomicity
 * so a slow handler can't release a token taken over by another worker after TTL.
 */
const RELEASE_LUA =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export async function releaseAccountMutex(
  platformAccountId: string,
  token: string,
): Promise<boolean> {
  const key = KEY_PREFIX + platformAccountId;
  const result = (await redis.eval(RELEASE_LUA, 1, key, token)) as number;
  return result === 1;
}
