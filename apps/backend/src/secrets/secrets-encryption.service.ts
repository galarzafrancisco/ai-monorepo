import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  isPlaintextSecretsInsecurelyAllowed,
  isSecretsEnabled,
} from '../config/env.config';
import { SecretsFeatureDisabledError } from './errors/secrets.errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag
const KEY_LENGTH = 32; // 256 bits

/**
 * Service for encrypting and decrypting secret values using AES-256-GCM.
 * The encryption key is sourced from the SECRETS_ENCRYPTION_KEY environment
 * variable (32-byte hex string, i.e. 64 hex characters). If
 * ALLOW_PLAINTEXT_SECRETS_INSECURE=true is set instead, values are stored
 * without encryption.
 *
 * Encrypted format (base64-encoded): <iv>:<authTag>:<ciphertext>
 *
 * When the SECRETS_ENABLED feature flag is off (default), the service starts
 * without requiring either mode. Calls to encrypt/decrypt will throw a
 * SecretsFeatureDisabledError (maps to HTTP 503) until the feature is enabled.
 *
 * IMPORTANT: If both SECRETS_ENCRYPTION_KEY and ALLOW_PLAINTEXT_SECRETS_INSECURE
 * are set, encryption takes precedence and plaintext mode is ignored.
 */
@Injectable()
export class SecretsEncryptionService {
  private readonly logger = new Logger(SecretsEncryptionService.name);
  private readonly key: Buffer | null;
  private readonly allowPlaintextStorage: boolean;

  constructor() {
    if (!isSecretsEnabled()) {
      // Feature flag is off — skip storage mode initialization entirely.
      // Encrypt/decrypt calls will fail at runtime if someone reaches them.
      this.logger.warn(
        'Secrets feature is disabled (SECRETS_ENABLED is not set to "true"). ' +
          'Secrets endpoints will return 503 until the feature is enabled.',
      );
      this.key = null;
      this.allowPlaintextStorage = false;
      return;
    }

    const envKey = process.env.SECRETS_ENCRYPTION_KEY;
    const plaintextFlagSet = isPlaintextSecretsInsecurelyAllowed();

    if (envKey) {
      // Encryption key is present — use encrypted storage
      const keyBuffer = Buffer.from(envKey, 'hex');
      if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(
          `SECRETS_ENCRYPTION_KEY must be a ${KEY_LENGTH * 2}-character hex string (${KEY_LENGTH} bytes). Got ${keyBuffer.length} bytes.`,
        );
      }
      this.key = keyBuffer;
      this.allowPlaintextStorage = false;

      // Warn if both encryption key and plaintext flag are set
      if (plaintextFlagSet) {
        this.logger.warn(
          'Both SECRETS_ENCRYPTION_KEY and ALLOW_PLAINTEXT_SECRETS_INSECURE are set. ' +
            'Encryption takes precedence. Secrets will be encrypted.',
        );
      }
    } else if (plaintextFlagSet) {
      // No encryption key, but plaintext mode is explicitly allowed
      this.logger.warn(
        'ALLOW_PLAINTEXT_SECRETS_INSECURE=true is set. Secrets will be stored without encryption. DO NOT use this for high-value secrets.',
      );
      this.key = null;
      this.allowPlaintextStorage = true;
    } else {
      // Neither encryption key nor plaintext flag is set
      throw new Error(
        'SECRETS_ENABLED=true requires either SECRETS_ENCRYPTION_KEY or ALLOW_PLAINTEXT_SECRETS_INSECURE=true. ' +
          `If using encryption, set SECRETS_ENCRYPTION_KEY to a ${KEY_LENGTH * 2}-character hex string (${KEY_LENGTH} bytes).`,
      );
    }
  }

  private assertEnabled(): void {
    if (!this.key && !this.allowPlaintextStorage) {
      throw new SecretsFeatureDisabledError();
    }
  }

  /**
   * Encrypt a plaintext value.
   * Returns a base64-encoded string in the format: <iv>:<authTag>:<ciphertext>
   * Throws SecretsFeatureDisabledError if the Secrets feature flag is disabled.
   */
  encrypt(plaintext: string): string {
    this.assertEnabled();
    if (this.allowPlaintextStorage) {
      return plaintext;
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key!, iv, {
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
   * Throws SecretsFeatureDisabledError if the Secrets feature flag is disabled.
   */
  decrypt(encryptedValue: string): string {
    this.assertEnabled();
    if (this.allowPlaintextStorage) {
      return encryptedValue;
    }
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key!, iv, {
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
