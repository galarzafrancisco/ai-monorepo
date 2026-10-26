import { describe, expect, it, vi } from 'vitest';
import { heardFromLabel, HEARD_FROM_OPTIONS, submitAccessRequest, validateAccessRequest } from './accessRequest';

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
  it('limits the "other" source text only when "Other" is chosen', () => {
    const long = 'x'.repeat(121);
    expect(validateAccessRequest({ email: 'a@b.dev', building: '', heardFrom: 'other', heardFromOther: long }).heardFromOther).toBeDefined();
    expect(validateAccessRequest({ email: 'a@b.dev', building: '', heardFrom: 'other', heardFromOther: 'x'.repeat(120) })).toEqual({});
    expect(validateAccessRequest({ email: 'a@b.dev', building: '', heardFrom: 'x', heardFromOther: long })).toEqual({});
  });
});

describe('submitAccessRequest', () => {
  const failWith = (status?: number) => vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status }));

  it('sends a trimmed payload and reports submitted only once the server confirms', async () => {
    const send = vi.fn().mockResolvedValue({ received: true });
    const res = await submitAccessRequest({ email: ' a@b.dev ', building: '  ' }, send);
    expect(res).toEqual({ status: 'submitted' });
    expect(send).toHaveBeenCalledWith({
      email: 'a@b.dev',
      building: undefined,
      heardFrom: undefined,
      heardFromOther: undefined,
      website: undefined,
    });
  });

  it('sends the source, with free text only for "Other"', async () => {
    const send = vi.fn().mockResolvedValue({ received: true });
    await submitAccessRequest({ email: 'a@b.dev', building: '', heardFrom: 'other', heardFromOther: ' a podcast ' }, send);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ heardFrom: 'other', heardFromOther: 'a podcast' }));
    await submitAccessRequest({ email: 'a@b.dev', building: '', heardFrom: 'linkedin', heardFromOther: 'stale' }, send);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ heardFrom: 'linkedin', heardFromOther: undefined }));
    await submitAccessRequest({ email: 'a@b.dev', building: '', heardFrom: 'other', heardFromOther: '  ' }, send);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ heardFrom: 'other', heardFromOther: undefined }));
  });

  it('maps server and network failures to honest non-submitted results', async () => {
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith(429))).toEqual({ status: 'busy' });
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith(400))).toEqual({ status: 'invalid' });
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith(500))).toEqual({ status: 'error' });
    expect(await submitAccessRequest({ email: 'a@b.dev', building: '' }, failWith())).toEqual({ status: 'error' });
  });
});

describe('heard-from options', () => {
  it('offers the agreed sources in order, ending with Other', () => {
    expect(HEARD_FROM_OPTIONS.map((o) => o.label)).toEqual([
      'X',
      'LinkedIn',
      'Word of mouth',
      'Saw a T-shirt at a conference',
      'Other',
    ]);
  });
  it('labels stored values and tolerates unknown or missing ones', () => {
    expect(heardFromLabel('conference_tshirt')).toBe('Saw a T-shirt at a conference');
    expect(heardFromLabel('future_value')).toBe('future_value');
    expect(heardFromLabel(null)).toBeNull();
  });
});
