/**
 * The browser's IANA timezone, such as "Australia/Sydney", or undefined when
 * the browser does not report a usable one. Sent with thread messages so the
 * threads agent can read "tomorrow at 5pm" in the user's time.
 */
export function browserTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Only IANA names; raw offsets carry no daylight-saving rules.
    return zone && /^[A-Za-z]/.test(zone) ? zone : undefined;
  } catch {
    return undefined;
  }
}
