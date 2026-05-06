import { exportJWK, generateKeyPair } from 'jose';
import type { KeyStore } from './types.js';

export async function memoryKeyStore(): Promise<KeyStore> {
  let version = 1;
  let pair = await generateKeyPair('RS256', { extractable: true });

  return {
    async getActiveSigningKey() {
      return pair.privateKey;
    },
    async getActiveKeyId() {
      return `memory-${version}`;
    },
    async getVerificationKey() {
      return pair.publicKey;
    },
    async listPublicKeys() {
      const jwk = await exportJWK(pair.publicKey);
      return [{ ...jwk, kid: `memory-${version}`, alg: 'RS256', use: 'sig' }];
    },
    async rotate() {
      version += 1;
      pair = await generateKeyPair('RS256', { extractable: true });
    },
  };
}
