import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Pure helpers describing the on-disk format of encrypted secrets:
 * base64(iv):base64(authTag):base64(ciphertext), AES-256-GCM.
 * SecretsEncryptionService uses them, as do the one-off migration that
 * encrypts pre-existing plaintext rows and tooling that runs without Nest
 * (the agent evals read a dev database with `decryptSecret`).
 */
export type StoredSecretClassification =
  /** Parses as an AES-GCM envelope and authenticates with the given key. */
  | 'encrypted'
  /** Does not have the envelope shape; treated as legacy plaintext. */
  | 'plaintext'
  /**
   * Has the envelope shape but does not authenticate with the key. Could be
   * plaintext that happens to look like an envelope, or a wrong key. Callers
   * must refuse to proceed rather than guess.
   */
  | 'ambiguous';

export function parseKeyHex(keyHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      `Encryption key must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes).`,
    );
  }
  return Buffer.from(keyHex, 'hex');
}

function isCanonicalBase64(value: string): boolean {
  return Buffer.from(value, 'base64').toString('base64') === value;
}

function hasEnvelopeShape(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const [iv, tag, ciphertext] = parts;
  if (!isCanonicalBase64(iv) || !isCanonicalBase64(tag)) return false;
  if (!isCanonicalBase64(ciphertext)) return false;
  return (
    Buffer.from(iv, 'base64').length === IV_LENGTH &&
    Buffer.from(tag, 'base64').length === TAG_LENGTH
  );
}

export function decryptEnvelope(value: string, key: Buffer): string {
  const parts = value.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  const [ivB64, tagB64, ciphertextB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64'),
    { authTagLength: TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptEnvelope(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function classifyStoredSecret(
  stored: string,
  key: Buffer,
): StoredSecretClassification {
  if (!hasEnvelopeShape(stored)) return 'plaintext';
  try {
    decryptEnvelope(stored, key);
    return 'encrypted';
  } catch {
    return 'ambiguous';
  }
}

/** Decrypts a stored value with a 64-character hex key, without building SecretsEncryptionService. */
export function decryptSecret(value: string, keyHex: string): string {
  return decryptEnvelope(value, parseKeyHex(keyHex));
}
