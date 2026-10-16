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

export type LatestUserMessage = {
  createdAt: Date;
  timezone: string | null;
};

export type TimeContext = {
  /** Current time, ISO 8601 with offset: in the user's timezone when known, else UTC. */
  now: string;
  /** IANA timezone of the latest user message, or null when unknown. */
  userTimezone: string | null;
  /** When the latest user message was sent, same format as `now`; null when no person has written. */
  lastUserMessageAt: string | null;
};

/**
 * What `get_time` returns. The user's timezone is the one recorded with their
 * latest message; nothing is guessed when it is missing.
 */
export function buildTimeContext(now: Date, latest: LatestUserMessage | null): TimeContext {
  const zone = latest?.timezone && isIanaTimeZone(latest.timezone) ? latest.timezone : null;
  const format = (instant: Date) => (zone ? formatInZone(instant, zone) : formatUtc(instant));
  return {
    now: format(now),
    userTimezone: zone,
    lastUserMessageAt: latest ? format(latest.createdAt) : null,
  };
}
