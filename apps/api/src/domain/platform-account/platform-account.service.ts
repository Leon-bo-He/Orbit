import type { platformAccounts, PlatformId, CookieStatus } from '../../db/schema/platform-accounts.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import {
  encryptStorageStateObject,
  decryptStorageStateObject,
} from '../../infrastructure/publishing/crypto.js';
import {
  normalizeToStorageState,
  missingDomains,
  type PlaywrightStorageState,
} from '../../infrastructure/publishing/cookie-import.js';
import { runnerClient } from '../../infrastructure/publishing/runner-client.js';

export type PlatformAccount = typeof platformAccounts.$inferSelect;

export type PlatformAccountPublic = Omit<PlatformAccount, 'storageStateEnc'>;

const SUPPORTED_PLATFORMS: PlatformId[] = [
  'douyin',
  'rednote',
  'wechat_video',
  'bilibili',
  'tiktok',
  'youtube',
  'instagram',
  'facebook',
  'x',
];

export interface IPlatformAccountRepository {
  create(data: {
    userId: string;
    platform: string;
    accountName: string;
    displayName?: string | null;
    storageStateEnc: string;
    cookieStatus: CookieStatus;
  }): Promise<PlatformAccount>;
  listByUser(userId: string, platform?: string): Promise<PlatformAccount[]>;
  findById(id: string): Promise<PlatformAccount | null>;
  findByIdOwnedBy(id: string, userId: string): Promise<PlatformAccount | null>;
  update(id: string, data: Partial<typeof platformAccounts.$inferInsert>): Promise<PlatformAccount | null>;
  delete(id: string): Promise<void>;
}

export class PlatformAccountService {
  constructor(private repo: IPlatformAccountRepository) {}

  async verifyOwnership(id: string, userId: string): Promise<PlatformAccount> {
    const row = await this.repo.findByIdOwnedBy(id, userId);
    if (!row) throw new ForbiddenError();
    return row;
  }

  async list(userId: string, platform?: string): Promise<PlatformAccountPublic[]> {
    const rows = await this.repo.listByUser(userId, platform);
    return rows.map(stripSecret);
  }

  async create(
    userId: string,
    body: {
      platform: string;
      accountName: string;
      displayName?: string | null;
      cookies: unknown;
    },
  ): Promise<{ account: PlatformAccountPublic; missingDomains: string[] }> {
    if (!SUPPORTED_PLATFORMS.includes(body.platform as PlatformId)) {
      throw new ValidationError(`Unsupported platform: ${body.platform}`);
    }
    if (!body.accountName.trim()) {
      throw new ValidationError('accountName is required');
    }
    const state: PlaywrightStorageState = normalizeToStorageState(body.cookies);
    if (state.cookies.length === 0) {
      throw new ValidationError('Cookie payload contained no cookies');
    }
    const missing = missingDomains(state, body.platform);
    const enc = encryptStorageStateObject(state);

    const created = await this.repo.create({
      userId,
      platform: body.platform,
      accountName: body.accountName.trim(),
      displayName: body.displayName?.trim() || null,
      storageStateEnc: enc,
      cookieStatus: 'unknown',
    });

    return { account: stripSecret(created), missingDomains: missing };
  }

  async replaceCookies(
    userId: string,
    id: string,
    cookies: unknown,
  ): Promise<{ account: PlatformAccountPublic; missingDomains: string[] }> {
    const existing = await this.verifyOwnership(id, userId);
    const state = normalizeToStorageState(cookies);
    if (state.cookies.length === 0) {
      throw new ValidationError('Cookie payload contained no cookies');
    }
    const missing = missingDomains(state, existing.platform);
    const enc = encryptStorageStateObject(state);
    const updated = await this.repo.update(id, {
      storageStateEnc: enc,
      cookieStatus: 'unknown',
      cookieCheckedAt: null,
      updatedAt: new Date(),
    });
    if (!updated) throw new NotFoundError('Platform account not found');
    return { account: stripSecret(updated), missingDomains: missing };
  }

  async rename(
    userId: string,
    id: string,
    body: { accountName?: string; displayName?: string | null },
  ): Promise<PlatformAccountPublic> {
    await this.verifyOwnership(id, userId);
    const updated = await this.repo.update(id, {
      ...(body.accountName !== undefined ? { accountName: body.accountName.trim() } : {}),
      ...(body.displayName !== undefined ? { displayName: body.displayName?.trim() || null } : {}),
      updatedAt: new Date(),
    });
    if (!updated) throw new NotFoundError('Platform account not found');
    return stripSecret(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.verifyOwnership(id, userId);
    await this.repo.delete(id);
  }

  /**
   * Round-trip the storageState through the runner's /validate endpoint and
   * persist the new cookie status (and any refreshed storageState) back to DB.
   */
  async revalidate(userId: string, id: string): Promise<{ valid: boolean; reason?: string }> {
    const account = await this.verifyOwnership(id, userId);
    await this.repo.update(id, { cookieStatus: 'checking', updatedAt: new Date() });

    const state = decryptStorageStateObject(account.storageStateEnc);
    let result;
    try {
      result = await runnerClient.validate({ platform: account.platform, storageState: state });
    } catch (err) {
      await this.repo.update(id, {
        cookieStatus: 'unknown',
        cookieCheckedAt: new Date(),
        updatedAt: new Date(),
      });
      throw err;
    }

    const patch: Partial<typeof account> & { updatedAt: Date } = {
      cookieStatus: result.valid ? 'valid' : 'invalid',
      cookieCheckedAt: new Date(),
      updatedAt: new Date(),
    };
    if (result.finalStorageState) {
      patch.storageStateEnc = encryptStorageStateObject(result.finalStorageState);
    }
    await this.repo.update(id, patch);

    if (result.valid) {
      return { valid: true };
    }
    if (result.reason !== undefined) {
      return { valid: false, reason: result.reason };
    }
    return { valid: false };
  }

  /**
   * Internal: the publishing worker calls this to get a decrypted storageState
   * for handing to the runner. Returns the row plus the decrypted state.
   */
  async loadForJob(id: string): Promise<{ account: PlatformAccount; storageState: object }> {
    const account = await this.repo.findById(id);
    if (!account) throw new NotFoundError('Platform account not found');
    const storageState = decryptStorageStateObject(account.storageStateEnc);
    return { account, storageState };
  }

  /**
   * Internal: persist a refreshed storageState returned by the runner after a
   * successful job, and bump last_used_at.
   */
  async persistRefreshedState(id: string, storageState: object | undefined): Promise<void> {
    const patch: Partial<typeof platformAccounts.$inferInsert> = {
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    };
    if (storageState) {
      patch.storageStateEnc = encryptStorageStateObject(storageState);
      patch.cookieStatus = 'valid';
      patch.cookieCheckedAt = new Date();
    }
    await this.repo.update(id, patch);
  }
}

function stripSecret(row: PlatformAccount): PlatformAccountPublic {
  const { storageStateEnc: _drop, ...rest } = row;
  return rest;
}
