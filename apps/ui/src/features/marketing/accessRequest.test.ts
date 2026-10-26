import { describe, expect, it } from 'vitest';
import { submitAccessRequest, validateAccessRequest } from './accessRequest';

describe('validateAccessRequest', () => {
  it('requires an email', () => {
    expect(validateAccessRequest({ email: ' ', building: '' }).email).toBeDefined();
  });
  it('rejects malformed emails', () => {
    expect(validateAccessRequest({ email: 'nope@', building: '' }).email).toBeDefined();
  });
  it('accepts a valid email', () => {
    expect(validateAccessRequest({ email: 'a@b.dev', building: '' })).toEqual({});
  });
  it('limits the free text', () => {
    expect(validateAccessRequest({ email: 'a@b.dev', building: 'x'.repeat(281) }).building).toBeDefined();
  });
});

describe('submitAccessRequest', () => {
  const input = { email: ' a@b.dev ', building: '' };
  const respond = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch;

  it('only reports submitted when the server accepted it', async () => {
    expect((await submitAccessRequest(input, respond(202))).status).toBe('submitted');
  });
  it('maps failures honestly', async () => {
    expect((await submitAccessRequest(input, respond(429))).status).toBe('rate_limited');
    expect((await submitAccessRequest(input, respond(400))).status).toBe('invalid');
    expect((await submitAccessRequest(input, respond(500))).status).toBe('error');
    const boom = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect((await submitAccessRequest(input, boom)).status).toBe('error');
  });
  it('sends trimmed email and omits empty optional fields', async () => {
    let body = '';
    const spy = (async (_u: unknown, init?: RequestInit) => { body = String(init?.body); return new Response('{}', { status: 202 }); }) as unknown as typeof fetch;
    await submitAccessRequest(input, spy);
    expect(JSON.parse(body)).toEqual({ email: 'a@b.dev' });
  });
});
