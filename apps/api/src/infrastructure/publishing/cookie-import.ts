import { ValidationError } from '../../domain/errors';

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface PlaywrightStorageState {
  cookies: PlaywrightCookie[];
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
}

/**
 * Cookie-Editor / EditThisCookie / Playwright `storageState` are all accepted at the
 * paste field. This normalizes them all into Playwright `storageState`.
 *
 * Cookie-Editor JSON shape:
 *   [{ "name": "...", "value": "...", "domain": ".douyin.com", "path": "/",
 *      "expirationDate": 1762200000.123, "hostOnly": false,
 *      "httpOnly": true, "secure": true, "session": false,
 *      "sameSite": "lax" | "no_restriction" | "strict" | "unspecified" }, ...]
 *
 * EditThisCookie shape is similar; field names match closely enough that the same
 * normalizer handles both.
 */
export function normalizeToStorageState(input: unknown): PlaywrightStorageState {
  if (input == null) {
    throw new ValidationError('Cookie payload is empty');
  }

  if (typeof input === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new ValidationError('Cookie payload is not valid JSON');
    }
    return normalizeToStorageState(parsed);
  }

  if (Array.isArray(input)) {
    return {
      cookies: input.map((c, i) => normalizeExtensionCookie(c, i)),
      origins: [],
    };
  }

  if (typeof input === 'object') {
    const obj = input as { cookies?: unknown; origins?: unknown };
    if (!Array.isArray(obj.cookies)) {
      throw new ValidationError('storageState.cookies must be an array');
    }
    return {
      cookies: obj.cookies.map((c, i) => normalizePlaywrightCookie(c, i)),
      origins: Array.isArray(obj.origins) ? (obj.origins as PlaywrightStorageState['origins']) : [],
    };
  }

  throw new ValidationError('Unrecognized cookie payload shape');
}

function normalizeExtensionCookie(raw: unknown, index: number): PlaywrightCookie {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError(`Cookie at index ${index} is not an object`);
  }
  const c = raw as Record<string, unknown>;
  const name = strField(c, 'name', index);
  const value = strField(c, 'value', index);
  const domain = strField(c, 'domain', index);
  const path = (c['path'] as string | undefined) ?? '/';

  const exp =
    typeof c['expirationDate'] === 'number'
      ? Math.floor(c['expirationDate'] as number)
      : typeof c['expires'] === 'number'
        ? Math.floor(c['expires'] as number)
        : -1;

  return {
    name,
    value,
    domain,
    path,
    expires: exp,
    httpOnly: Boolean(c['httpOnly']),
    secure: Boolean(c['secure']),
    sameSite: mapSameSite(c['sameSite']),
  };
}

function normalizePlaywrightCookie(raw: unknown, index: number): PlaywrightCookie {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError(`Cookie at index ${index} is not an object`);
  }
  const c = raw as Record<string, unknown>;
  return {
    name: strField(c, 'name', index),
    value: strField(c, 'value', index),
    domain: strField(c, 'domain', index),
    path: (c['path'] as string | undefined) ?? '/',
    expires: typeof c['expires'] === 'number' ? (c['expires'] as number) : -1,
    httpOnly: Boolean(c['httpOnly']),
    secure: Boolean(c['secure']),
    sameSite: mapSameSite(c['sameSite']),
  };
}

function strField(c: Record<string, unknown>, key: string, index: number): string {
  const v = c[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new ValidationError(`Cookie at index ${index} is missing string field "${key}"`);
  }
  return v;
}

function mapSameSite(v: unknown): 'Strict' | 'Lax' | 'None' {
  if (typeof v !== 'string') return 'Lax';
  const s = v.toLowerCase();
  if (s === 'strict') return 'Strict';
  if (s === 'none' || s === 'no_restriction') return 'None';
  return 'Lax';
}

/**
 * Required cookie domains for each platform. Missing domains is a soft warning
 * (some platforms will still authenticate with a subset; YouTube/X commonly
 * need all three).
 */
export const PLATFORM_EXPECTED_DOMAINS: Record<string, string[]> = {
  douyin: ['.douyin.com'],
  rednote: ['.xiaohongshu.com'],
  wechat_video: ['.weixin.qq.com'],
  bilibili: ['.bilibili.com'],
  tiktok: ['.tiktok.com'],
  youtube: ['.google.com', '.youtube.com'],
  instagram: ['.instagram.com'],
  facebook: ['.facebook.com'],
  x: ['.x.com'],
};

export function missingDomains(state: PlaywrightStorageState, platform: string): string[] {
  const expected = PLATFORM_EXPECTED_DOMAINS[platform] ?? [];
  const present = new Set(state.cookies.map((c) => c.domain.toLowerCase()));
  return expected.filter((d) => !present.has(d.toLowerCase()));
}
