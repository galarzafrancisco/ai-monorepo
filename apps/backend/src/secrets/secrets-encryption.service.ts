import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { isDevelopment } from '../config/env.config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag
const KEY_LENGTH = 32; // 256 bits

/**
 * Service for encrypting and decrypting secret values using AES-256-GCM.
 * The encryption key is sourced from the SECRETS_ENCRYPTION_KEY environment
 * variable (32-byte hex string, i.e. 64 hex characters).
 *
 * Encrypted format (base64-encoded): <iv>:<authTag>:<ciphertext>
 */
@Injectable()
export class SecretsEncryptionService {
  private readonly logger = new Logger(SecretsEncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const envKey = process.env.SECRETS_ENCRYPTION_KEY;
    if (envKey) {
      const keyBuffer = Buffer.from(envKey, 'hex');
      if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(
          `SECRETS_ENCRYPTION_KEY must be a ${KEY_LENGTH * 2}-character hex string (${KEY_LENGTH} bytes). Got ${keyBuffer.length} bytes.`,
        );
      }
      this.key = keyBuffer;
    } else if (isDevelopment()) {
      // Development fallback: derive a fixed key from a well-known dev secret
      this.logger.warn(
        'SECRETS_ENCRYPTION_KEY is not set. Using a fixed development key. DO NOT use this in production.',
      );
      this.key = crypto.scryptSync('taico-dev-secrets-key', 'taico-salt', KEY_LENGTH);
    } else {
      throw new Error(
        'SECRETS_ENCRYPTION_KEY environment variable is required in production. ' +
          `Set it to a ${KEY_LENGTH * 2}-character hex string (${KEY_LENGTH} bytes).`,
      );
    }
  }

  /**
   * Encrypt a plaintext value.
   * Returns a base64-encoded string in the format: <iv>:<authTag>:<ciphertext>
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_LENGTH,
    });

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Pack as: base64(iv):base64(authTag):base64(ciphertext)
    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt an encrypted value.
   * Expects format: <iv>:<authTag>:<ciphertext> (all base64-encoded)
   */
  decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}
