/** client_assertion_type of a JWT used for client authentication (RFC 7523 section 2.2) */
export const JWT_BEARER_CLIENT_ASSERTION_TYPE =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/**
 * Signature algorithms accepted on a client assertion. Asymmetric only: the
 * client proves it holds a private key, and we only ever see the public one.
 */
export const CLIENT_ASSERTION_SIGNING_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
];

const MAX_KEYS = 10;

// Members of a JWK that are only present on a private or symmetric key
const SECRET_KEY_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];

/**
 * Validates a JWK Set that must hold public keys only. Used for keys inside a
 * metadata document and for keys fetched from a client's jwks_uri.
 */
export function parsePublicJwks(
  value: unknown,
  reject: (reason: string) => never,
): { keys: Record<string, unknown>[] } {
  const keys = (value as { keys?: unknown } | null)?.keys;
  if (
    !Array.isArray(keys) ||
    keys.length === 0 ||
    !keys.every(
      (key): key is Record<string, unknown> =>
        typeof key === 'object' && key !== null && !Array.isArray(key),
    )
  ) {
    return reject(
      'the key set must be a JSON object with a non-empty keys array',
    );
  }
  if (keys.length > MAX_KEYS) {
    reject(`the key set has more than ${MAX_KEYS} keys`);
  }
  for (const key of keys) {
    if (
      key.kty === 'oct' ||
      SECRET_KEY_MEMBERS.some((member) => member in key)
    ) {
      reject('the key set must contain public keys only');
    }
  }
  return { keys };
}
