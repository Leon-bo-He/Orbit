import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../../config';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = config.STORAGE_STATE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'STORAGE_STATE_ENCRYPTION_KEY is not configured. Generate 32 random bytes and base64-encode them.',
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('STORAGE_STATE_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).');
  }
  return buf;
}

export function encryptStorageState(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptStorageState(envelope: string): string {
  const buf = Buffer.from(envelope, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('storage_state_enc envelope is malformed');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptStorageStateObject(state: object): string {
  return encryptStorageState(JSON.stringify(state));
}

export function decryptStorageStateObject(envelope: string): object {
  return JSON.parse(decryptStorageState(envelope));
}
