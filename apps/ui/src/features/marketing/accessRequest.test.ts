import { describe, expect, it, vi } from 'vitest';
import { submitAccessRequest, validateAccessRequest } from './accessRequest';

describe('validateAccessRequest', () => {
  it('requires an email', () => {
    expect(validateAccessRequest({ email: ' ', building: '' }).email).toBeDefined();
  });
  it('rejects malformed emails', () => {
    expect(validateAccessRequest({ email: 'nope@', building: '' }).email).toBeDefined();
  });
  it('rejects overlong emails', () => {
    expect(validateAccessRequest({ email: `${'a'.repeat(250)}@b.dev`, building: '' }).email).toBeDefined();
  });
  it('accepts a valid email', () => {
    expect(validateAccessRequest({ email: 'a@b.dev', building: '' })).toEqual({});
  });
  it('limits the free text', () => {
    expect(validateAccessRequest({ email: 'a@b.dev', building: 'x'.repeat(281) }).building).toBeDefined();
    expect(validateAccessRequest({ email: 'a@b.dev', building: 'x'.repeat(280) })).toEqual({});
  });
});

describe('submitAccessRequest', () => {
  const failWith = (status?: number) => vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status }));

  it('sends a trimmed payload and reports submitted only once the server confirms', async () => {
    const send = vi.fn().mockResolvedValue({ received: true });
    const res = await submitAccessRequest({ email: ' a@b.dev ', building: '  ' }, send);
    expect(res).toEqual({ status: 'submitted' });
    expect(send).toHaveBeenCalledWith({ email: 'a@b.dev', building: undefined, website: undefined });
  });

  it('maps server and network failures to honest non-submitted results', async () => {
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith(429))).toEqual({ status: 'busy' });
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith(400))).toEqual({ status: 'invalid' });
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith(500))).toEqual({ status: 'error' });
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith())).toEqual({ status: 'error' });
  });
});
