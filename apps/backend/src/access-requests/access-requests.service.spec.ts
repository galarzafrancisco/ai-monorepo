import { createHash } from 'crypto';
import { AccessRequestsService } from './access-requests.service';

describe('AccessRequestsService.hashIp', () => {
  it('returns null without an ip', () => {
    expect(AccessRequestsService.hashIp(undefined)).toBeNull();
  });

  it('is not the unkeyed SHA-256 of the ip (not reversible by enumeration)', () => {
    const unkeyed = createHash('sha256').update('taico-access-request:1.2.3.4').digest('hex');
    expect(AccessRequestsService.hashIp('1.2.3.4', 'k1')).not.toBe(unkeyed);
    expect(AccessRequestsService.hashIp('1.2.3.4', 'k1')).not.toBe(createHash('sha256').update('1.2.3.4').digest('hex'));
  });

  it('is deterministic per key and differs across keys', () => {
    const a = AccessRequestsService.hashIp('1.2.3.4', 'k1');
    expect(AccessRequestsService.hashIp('1.2.3.4', 'k1')).toBe(a);
    expect(AccessRequestsService.hashIp('1.2.3.4', 'k2')).not.toBe(a);
  });

  it('falls back to a stable per-process random key when none is configured', () => {
    const prev = process.env.ACCESS_REQUEST_IP_HASH_KEY;
    delete process.env.ACCESS_REQUEST_IP_HASH_KEY;
    try {
      expect(AccessRequestsService.hashIp('1.2.3.4')).toBe(AccessRequestsService.hashIp('1.2.3.4'));
    } finally {
      if (prev !== undefined) process.env.ACCESS_REQUEST_IP_HASH_KEY = prev;
    }
  });
});
