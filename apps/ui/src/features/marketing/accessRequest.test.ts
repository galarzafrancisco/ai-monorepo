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

describe('submitAccessRequest placeholder', () => {
  it('never claims the request was submitted', async () => {
    const res = await submitAccessRequest({ email: 'a@b.dev', building: '' });
    expect(res.status).toBe('not_connected');
  });
});
