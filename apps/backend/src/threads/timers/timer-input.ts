/**
 * Parsing for what the threads agent passes to the timer tools. Every function
 * returns either a value or a sentence the agent can act on: bad input is
 * reported back to the model, never thrown.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Longest period or delay a timer accepts. */
export const MAX_DURATION_SECONDS = 366 * 24 * 60 * 60;
/** Most firings a schedule accepts. */
export const MAX_ITERATIONS = 10;

const UNIT_SECONDS = { s: 1, m: 60, h: 3600 } as const;
const UNIT_NAMES = { s: 'second', m: 'minute', h: 'hour' } as const;

/** A positive integer and one unit: "30s", "5m", "2h". Nothing compound. */
export function parseDuration(input: string): Parsed<number> {
  const match = /^([1-9]\d*)([smh])$/.exec(input.trim());
  if (!match) {
    return {
      ok: false,
      error: `Invalid duration "${input}". Use a positive whole number followed by one unit: s, m or h (for example "30s", "5m", "2h"). Compound values such as "1h30m" are not supported; use "90m".`,
    };
  }

  const seconds = Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
  if (seconds > MAX_DURATION_SECONDS) {
    return { ok: false, error: `Duration "${input}" is too long. The longest supported is 366 days.` };
  }
  return { ok: true, value: seconds };
}

export function parseMaxIterations(input: unknown): Parsed<number> {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 1) {
    return { ok: false, error: 'maxIterations must be a positive whole number.' };
  }
  if (input > MAX_ITERATIONS) {
    return { ok: false, error: `maxIterations can be at most ${MAX_ITERATIONS}.` };
  }
  return { ok: true, value: input };
}

/** "5 minutes", "1 hour", "90 seconds": the largest unit that divides evenly. */
export function describeDuration(seconds: number): string {
  for (const unit of ['h', 'm', 's'] as const) {
    if (seconds % UNIT_SECONDS[unit] === 0) {
      const count = seconds / UNIT_SECONDS[unit];
      return `${count} ${UNIT_NAMES[unit]}${count === 1 ? '' : 's'}`;
    }
  }
  return `${seconds} seconds`;
}

const DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * An absolute instant from an ISO 8601 datetime. Either the datetime carries
 * its offset ("Z" or "+10:00"), or it is a local time and `timezone` names an
 * IANA zone. Nothing is guessed: a local time with no zone, a zone that
 * disagrees with the offset, and a local time a DST change skips or repeats
 * are all rejected.
 */
export function parseInstant(at: string, timezone?: string): Parsed<Date> {
  const match = DATETIME_PATTERN.exec(at.trim());
  if (!match) {
    return {
      ok: false,
      error: `Invalid datetime "${at}". Use ISO 8601, for example "2026-10-15T12:00:00Z", "2026-10-15T12:00:00+11:00", or "2026-10-15T12:00:00" with a timezone such as "Australia/Sydney".`,
    };
  }

  const [, year, month, day, hour, minute, second = '0', offset] = match;
  const fields = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  const check = new Date(asUtc);
  if (
    check.getUTCFullYear() !== fields.year ||
    check.getUTCMonth() !== fields.month - 1 ||
    check.getUTCDate() !== fields.day ||
    check.getUTCHours() !== fields.hour ||
    check.getUTCMinutes() !== fields.minute ||
    check.getUTCSeconds() !== fields.second
  ) {
    return { ok: false, error: `"${at}" is not a real date and time.` };
  }

  const zone = timezone?.trim() || undefined;
  if (zone && !isValidTimeZone(zone)) {
    return { ok: false, error: `Unknown timezone "${timezone}". Use an IANA name such as "Australia/Sydney" or "UTC".` };
  }

  if (offset) {
    const offsetMinutes = offset === 'Z' ? 0 : parseOffset(offset);
    if (offsetMinutes === null) {
      return {
        ok: false,
        error: `"${at}" has offset ${offset}, which is not a real UTC offset. Offsets run from -12:00 to +14:00 with minutes 00-59.`,
      };
    }
    const instant = new Date(asUtc - offsetMinutes * 60_000);
    if (zone && zoneOffsetMinutes(zone, instant) !== offsetMinutes) {
      return {
        ok: false,
        error: `"${at}" has offset ${offset}, which does not match timezone "${zone}" at that time. Give either the offset or the timezone, not conflicting ones.`,
      };
    }
    return { ok: true, value: instant };
  }

  if (!zone) {
    // Not "add Z for UTC": told that, a model without the user's timezone set
    // "10 am" reminders at 10:00 UTC instead of asking.
    return {
      ok: false,
      error: `"${at}" has no offset and no timezone. Pass the user's timezone (from get_time). If get_time returns no userTimezone, ask the user for their timezone; never assume UTC.`,
    };
  }

  // Every offset the zone uses around that day; keep the ones that land on the wall time.
  const candidateOffsets = new Set(
    [-86_400_000, 0, 86_400_000].map((shift) => zoneOffsetMinutes(zone, new Date(asUtc + shift))),
  );
  const instants = [...candidateOffsets]
    .map((offsetMinutes) => new Date(asUtc - offsetMinutes * 60_000))
    .filter((instant) => zoneOffsetMinutes(zone, instant) * 60_000 === asUtc - instant.getTime());
  const unique = [...new Set(instants.map((instant) => instant.getTime()))];

  if (unique.length === 0) {
    return { ok: false, error: `${at} does not exist in ${zone}: the clocks skip it for daylight saving. Pick another time.` };
  }
  if (unique.length > 1) {
    return {
      ok: false,
      error: `${at} happens twice in ${zone} because of daylight saving. Give an offset to say which one (for example "${at}${formatOffset(zoneOffsetMinutes(zone, new Date(Math.min(...unique))))}").`,
    };
  }
  return { ok: true, value: new Date(unique[0]) };
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Earliest and latest offsets any zone uses: -12:00 and +14:00. */
const MIN_OFFSET_MINUTES = -12 * 60;
const MAX_OFFSET_MINUTES = 14 * 60;

/** Minutes ahead of UTC for "+HH:MM" / "-HH:MM", or null when no real zone could use it. */
function parseOffset(offset: string): number | null {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  if (minutes > 59) {
    return null;
  }
  const total = sign * (hours * 60 + minutes);
  if (total < MIN_OFFSET_MINUTES || total > MAX_OFFSET_MINUTES) {
    return null;
  }
  return total;
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** How far `zone` is ahead of UTC at `instant`, in minutes. */
export function zoneOffsetMinutes(zone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((wallAsUtc - wholeSeconds) / 60_000);
}
