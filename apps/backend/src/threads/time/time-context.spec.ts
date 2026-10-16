import { buildTimeContext, formatInZone, formatUtc, isIanaTimeZone } from './time-context';

describe('isIanaTimeZone', () => {
  it.each(['Australia/Sydney', 'America/New_York', 'UTC', 'Asia/Kolkata', 'America/Argentina/Buenos_Aires'])(
    'accepts %s',
    (zone) => expect(isIanaTimeZone(zone)).toBe(true),
  );

  it.each(['', '   ', '+10:00', '-05:00', 'Not/AZone', 'x'.repeat(65), 42, null, undefined])(
    'rejects %p',
    (zone) => expect(isIanaTimeZone(zone)).toBe(false),
  );
});

describe('formatInZone', () => {
  it('formats UTC with whole seconds', () => {
    expect(formatUtc(new Date('2026-10-16T05:13:14.988Z'))).toBe('2026-10-16T05:13:14Z');
  });

  it('uses half-hour offsets', () => {
    expect(formatInZone(new Date('2026-01-01T00:00:00Z'), 'Asia/Kolkata')).toBe('2026-01-01T05:30:00+05:30');
  });

  it('crosses the date line', () => {
    expect(formatInZone(new Date('2026-06-30T20:00:00Z'), 'Pacific/Auckland')).toBe('2026-07-01T08:00:00+12:00');
  });

  describe('daylight saving boundaries', () => {
    // Sydney moves from +10:00 to +11:00 at 2026-10-04 02:00 local (2026-10-03T16:00:00Z).
    it('Sydney just before and after the spring-forward', () => {
      expect(formatInZone(new Date('2026-10-03T15:59:59Z'), 'Australia/Sydney')).toBe('2026-10-04T01:59:59+10:00');
      expect(formatInZone(new Date('2026-10-03T16:00:00Z'), 'Australia/Sydney')).toBe('2026-10-04T03:00:00+11:00');
    });

    // New York falls back from -04:00 to -05:00 at 2026-11-01 02:00 local (06:00Z): 01:30 happens twice.
    it('New York gives the repeated hour distinct offsets', () => {
      expect(formatInZone(new Date('2026-11-01T05:30:00Z'), 'America/New_York')).toBe('2026-11-01T01:30:00-04:00');
      expect(formatInZone(new Date('2026-11-01T06:30:00Z'), 'America/New_York')).toBe('2026-11-01T01:30:00-05:00');
    });
  });
});

describe('buildTimeContext', () => {
  const now = new Date('2026-10-16T05:13:14.988Z');

  it('returns now and the latest message in the user timezone', () => {
    const context = buildTimeContext(now, {
      createdAt: new Date('2026-10-16T05:10:00Z'),
      timezone: 'Australia/Sydney',
      authorName: 'Fran',
      authorSlug: 'fran',
    });

    expect(context).toEqual({
      now: '2026-10-16T05:13:14Z',
      userTimezone: 'Australia/Sydney',
      nowInUserTimezone: { local: '2026-10-16T16:13:14+11:00', utcOffset: '+11:00', dayOfWeek: 'Friday' },
      latestUserMessage: {
        sentAt: '2026-10-16T05:10:00Z',
        sentAtInUserTimezone: { local: '2026-10-16T16:10:00+11:00', utcOffset: '+11:00', dayOfWeek: 'Friday' },
        timezone: 'Australia/Sydney',
        author: 'Fran @fran',
      },
      notes: [],
    });
  });

  it('uses the offset in force at each instant across a DST change', () => {
    // Message sent before Sydney's spring-forward, read after it.
    const context = buildTimeContext(new Date('2026-10-04T00:00:00Z'), {
      createdAt: new Date('2026-10-03T12:00:00Z'),
      timezone: 'Australia/Sydney',
      authorName: 'Fran',
      authorSlug: 'fran',
    });

    expect(context.latestUserMessage?.sentAtInUserTimezone?.local).toBe('2026-10-03T22:00:00+10:00');
    expect(context.nowInUserTimezone?.local).toBe('2026-10-04T11:00:00+11:00');
  });

  it('reports a missing timezone without guessing', () => {
    const context = buildTimeContext(now, {
      createdAt: new Date('2026-10-16T05:10:00Z'),
      timezone: null,
      authorName: 'Fran',
      authorSlug: 'fran',
    });

    expect(context.userTimezone).toBeNull();
    expect(context.nowInUserTimezone).toBeNull();
    expect(context.latestUserMessage).toMatchObject({
      sentAt: '2026-10-16T05:10:00Z',
      sentAtInUserTimezone: null,
      timezone: null,
    });
    expect(context.notes.join(' ')).toMatch(/no timezone recorded/);
    expect(context.notes.join(' ')).toMatch(/Do not guess/);
  });

  it('treats a stored timezone the runtime does not know as missing', () => {
    const context = buildTimeContext(now, {
      createdAt: now,
      timezone: 'Mars/Olympus_Mons',
      authorName: null,
      authorSlug: null,
    });
    expect(context.userTimezone).toBeNull();
    expect(context.latestUserMessage?.author).toBeNull();
  });

  it('handles a thread with no user message', () => {
    const context = buildTimeContext(now, null);
    expect(context.now).toBe('2026-10-16T05:13:14Z');
    expect(context.latestUserMessage).toBeNull();
    expect(context.userTimezone).toBeNull();
    expect(context.notes.join(' ')).toMatch(/No person has written/);
  });
});
