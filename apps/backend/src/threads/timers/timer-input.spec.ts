import {
  describeDuration,
  parseDuration,
  parseInstant,
  parseMaxIterations,
} from './timer-input';

describe('timer input', () => {
  describe('parseDuration', () => {
    it.each([
      ['5s', 5],
      ['5m', 300],
      ['2h', 7200],
      [' 90m ', 5400],
    ])('reads %p as %p seconds', (input, seconds) => {
      expect(parseDuration(input)).toEqual({ ok: true, value: seconds });
    });

    it.each(['1h30m', '0m', '-5m', '5', 'm', '5d', '1.5h', '05m', ''])('rejects %p', (input) => {
      expect(parseDuration(input).ok).toBe(false);
    });

    it('rejects durations longer than a year', () => {
      expect(parseDuration('9000h').ok).toBe(false);
    });
  });

  describe('parseMaxIterations', () => {
    it('accepts positive whole numbers', () => {
      expect(parseMaxIterations(5)).toEqual({ ok: true, value: 5 });
    });

    it('accepts up to 10', () => {
      expect(parseMaxIterations(10)).toEqual({ ok: true, value: 10 });
    });

    it.each([0, -1, 1.5, '5', undefined, 11])('rejects %p', (input) => {
      expect(parseMaxIterations(input).ok).toBe(false);
    });
  });

  describe('describeDuration', () => {
    it.each([
      [300, '5 minutes'],
      [3600, '1 hour'],
      [90, '90 seconds'],
      [5400, '90 minutes'],
    ])('describes %p seconds as %p', (seconds, text) => {
      expect(describeDuration(seconds)).toBe(text);
    });
  });

  describe('parseInstant', () => {
    const iso = (at: string, timezone?: string) => {
      const result = parseInstant(at, timezone);
      return result.ok ? result.value.toISOString() : result.error;
    };

    it('reads UTC and offset timestamps', () => {
      expect(iso('2026-10-15T12:00:00Z')).toBe('2026-10-15T12:00:00.000Z');
      expect(iso('2026-10-15T12:00:00+11:00')).toBe('2026-10-15T01:00:00.000Z');
      expect(iso('2026-10-15T12:00-03:30')).toBe('2026-10-15T15:30:00.000Z');
    });

    it('reads a local time in a timezone', () => {
      // Sydney is on daylight time (+11:00) in October.
      expect(iso('2026-10-15T12:00:00', 'Australia/Sydney')).toBe('2026-10-15T01:00:00.000Z');
      expect(iso('2026-07-15T12:00:00', 'Australia/Sydney')).toBe('2026-07-15T02:00:00.000Z');
    });

    it('accepts an offset that agrees with the timezone', () => {
      expect(iso('2026-10-15T12:00:00+11:00', 'Australia/Sydney')).toBe('2026-10-15T01:00:00.000Z');
    });

    it('rejects an offset that conflicts with the timezone', () => {
      expect(parseInstant('2026-10-15T12:00:00+10:00', 'Australia/Sydney').ok).toBe(false);
    });

    it('rejects a local time with no timezone, telling the model to ask rather than use UTC', () => {
      const result = parseInstant('2026-10-15T12:00:00');
      expect(result.ok).toBe(false);
      const error = (result as { error: string }).error;
      expect(error).toContain('ask the user for their timezone');
      expect(error).not.toContain('"Z" for UTC');
    });

    it('rejects a local time that daylight saving skips', () => {
      // Sydney clocks jump from 02:00 to 03:00 on 2026-10-04.
      const result = parseInstant('2026-10-04T02:30:00', 'Australia/Sydney');
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain('does not exist');
    });

    it('rejects a local time that daylight saving repeats', () => {
      // Sydney clocks fall back from 03:00 to 02:00 on 2026-04-05.
      const result = parseInstant('2026-04-05T02:30:00', 'Australia/Sydney');
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain('happens twice');
    });

    it('accepts the extreme real offsets', () => {
      expect(iso('2026-10-15T12:00:00+14:00')).toBe('2026-10-14T22:00:00.000Z');
      expect(iso('2026-10-15T12:00:00-12:00')).toBe('2026-10-16T00:00:00.000Z');
      expect(iso('2026-10-15T12:00:00+05:45')).toBe('2026-10-15T06:15:00.000Z');
    });

    it.each(['+24:00', '+11:60', '-13:00', '+14:01', '+99:99'])('rejects the invalid offset %p', (offset) => {
      const result = parseInstant(`2026-10-15T12:00:00${offset}`);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain('not a real UTC offset');
    });

    it('rejects unknown timezones, impossible dates and other formats', () => {
      expect(parseInstant('2026-10-15T12:00:00', 'Mars/Olympus').ok).toBe(false);
      expect(parseInstant('2026-02-30T12:00:00Z').ok).toBe(false);
      expect(parseInstant('tomorrow at noon').ok).toBe(false);
    });
  });
});
