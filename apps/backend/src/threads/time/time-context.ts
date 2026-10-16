import { formatOffset, isValidTimeZone, zoneOffsetMinutes } from '../timers/timer-input';

/** Longest IANA timezone name accepted from a client. */
export const MAX_TIMEZONE_LENGTH = 64;

/**
 * True for an IANA timezone name the runtime knows, such as
 * "Australia/Sydney" or "UTC". Raw offsets ("+10:00") are rejected: an offset
 * says nothing about daylight saving, so it cannot place "tomorrow at 5pm".
 */
export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const zone = value.trim();
  if (!zone || zone.length > MAX_TIMEZONE_LENGTH || !/^[A-Za-z]/.test(zone)) {
    return false;
  }
  return isValidTimeZone(zone);
}

/** "2026-10-16T05:13:14Z": UTC, whole seconds. */
export function formatUtc(instant: Date): string {
  return `${instant.toISOString().slice(0, 19)}Z`;
}

/** "2026-10-16T16:13:14+11:00": the wall time in `zone`, with the offset it had then. */
export function formatInZone(instant: Date, zone: string): string {
  const offset = zoneOffsetMinutes(zone, instant);
  const wall = new Date(Math.floor(instant.getTime() / 1000) * 1000 + offset * 60_000);
  return `${wall.toISOString().slice(0, 19)}${formatOffset(offset)}`;
}

/** Offset of `zone` at `instant`, as "+11:00". */
export function offsetInZone(instant: Date, zone: string): string {
  return formatOffset(zoneOffsetMinutes(zone, instant));
}

/** "Friday" in `zone` at `instant`. */
export function weekdayInZone(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long' }).format(instant);
}

export type LatestUserMessage = {
  createdAt: Date;
  timezone: string | null;
  authorName: string | null;
  authorSlug: string | null;
};

type ZonedTime = {
  /** ISO 8601 with the zone's offset at that moment. */
  local: string;
  utcOffset: string;
  dayOfWeek: string;
};

export type TimeContext = {
  /** Current time, ISO 8601 in UTC. */
  now: string;
  /** IANA timezone of the latest user message, or null when unknown. */
  userTimezone: string | null;
  /** Current time in `userTimezone`, or null when it is unknown. */
  nowInUserTimezone: ZonedTime | null;
  latestUserMessage: {
    /** When it was sent, ISO 8601 in UTC. */
    sentAt: string;
    /** When it was sent in the sender's timezone, or null when it is unknown. */
    sentAtInUserTimezone: ZonedTime | null;
    timezone: string | null;
    author: string | null;
  } | null;
  notes: string[];
};

function zoned(instant: Date, zone: string): ZonedTime {
  return {
    local: formatInZone(instant, zone),
    utcOffset: offsetInZone(instant, zone),
    dayOfWeek: weekdayInZone(instant, zone),
  };
}

/**
 * What `get_time` returns. The user's timezone is the one recorded with their
 * latest message; nothing is guessed when it is missing.
 */
export function buildTimeContext(now: Date, latest: LatestUserMessage | null): TimeContext {
  const notes: string[] = [];
  const zone = latest?.timezone && isIanaTimeZone(latest.timezone) ? latest.timezone : null;

  if (!latest) {
    notes.push('No person has written in this thread yet, so their timezone is unknown.');
  } else if (!zone) {
    notes.push("The latest user message has no timezone recorded (it may predate timezone tracking or come from a client that did not send one).");
  }
  if (!zone) {
    notes.push(
      'Do not guess the timezone. For a local time such as "tomorrow at 5pm", ask the user for their timezone, or state that you are using UTC.',
    );
  }

  return {
    now: formatUtc(now),
    userTimezone: zone,
    nowInUserTimezone: zone ? zoned(now, zone) : null,
    latestUserMessage: latest
      ? {
          sentAt: formatUtc(latest.createdAt),
          sentAtInUserTimezone: zone ? zoned(latest.createdAt, zone) : null,
          timezone: zone,
          author: latest.authorSlug
            ? `${latest.authorName ?? latest.authorSlug} @${latest.authorSlug}`
            : latest.authorName,
        }
      : null,
    notes,
  };
}
