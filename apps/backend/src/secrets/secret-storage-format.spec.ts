import {
  classifyStoredSecret,
  decryptEnvelope,
  decryptSecret,
  encryptEnvelope,
  parseKeyHex,
} from './secret-storage-format';

describe('secret-storage-format', () => {
  const key = parseKeyHex('11'.repeat(32));
  const otherKey = parseKeyHex('22'.repeat(32));

  it('round-trips with the envelope format', () => {
    const encrypted = encryptEnvelope('sk-test-value', key);
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decryptEnvelope(encrypted, key)).toBe('sk-test-value');
  });

  it('decrypts with a hex key, without the service', () => {
    const encrypted = encryptEnvelope('sk-test-value', key);
    expect(decryptSecret(encrypted, '11'.repeat(32))).toBe('sk-test-value');
    expect(() => decryptSecret(encrypted, '22'.repeat(32))).toThrow();
    expect(() => decryptSecret(encrypted, 'not-hex')).toThrow();
    expect(() => decryptSecret('no-envelope', '11'.repeat(32))).toThrow(
      'Invalid encrypted value format',
    );
  });

  it('classifies a freshly encrypted value as encrypted', () => {
    expect(classifyStoredSecret(encryptEnvelope('x', key), key)).toBe(
      'encrypted',
    );
  });

  it('classifies ordinary API keys as plaintext', () => {
    expect(classifyStoredSecret('sk-proj-abc123', key)).toBe('plaintext');
    expect(classifyStoredSecret('a:b:c', key)).toBe('plaintext');
  });

  it('flags envelope-shaped values that do not authenticate as ambiguous', () => {
    const encryptedWithOtherKey = encryptEnvelope('x', otherKey);
    expect(classifyStoredSecret(encryptedWithOtherKey, key)).toBe('ambiguous');
    // Shape-valid but random bytes: must not be silently treated as plaintext.
    const iv = Buffer.alloc(12, 1).toString('base64');
    const tag = Buffer.alloc(16, 2).toString('base64');
    const ct = Buffer.from('not-real').toString('base64');
    expect(classifyStoredSecret(`${iv}:${tag}:${ct}`, key)).toBe('ambiguous');
  });

  it('rejects keys that are not 32 bytes of hex', () => {
    expect(() => parseKeyHex('abc')).toThrow();
    expect(() => parseKeyHex('zz'.repeat(32))).toThrow();
  });
});
