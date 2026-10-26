/**
 * Request-access form logic. Validation is pure so it can be unit tested; the
 * server re-validates everything.
 */
export interface AccessRequestInput {
  email: string;
  building: string;
}

export type AccessRequestErrors = Partial<Record<keyof AccessRequestInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const BUILDING_MAX = 280;

export function validateAccessRequest(input: AccessRequestInput): AccessRequestErrors {
  const errors: AccessRequestErrors = {};
  const email = input.email.trim();
  if (!email) errors.email = 'Enter your email so we know where to reach you.';
  else if (!EMAIL_RE.test(email)) errors.email = 'That doesn’t look like an email address.';
  if (input.building.length > BUILDING_MAX) {
    errors.building = `Keep it under ${BUILDING_MAX} characters.`;
  }
  return errors;
}

export type AccessRequestResult =
  | { status: 'submitted' }
  | { status: 'rate_limited' }
  | { status: 'invalid' }
  | { status: 'error' };

/**
 * POSTs to the public, write-only endpoint. Returns `submitted` only when the
 * server confirmed (HTTP 2xx), i.e. the request has been stored.
 * `website` is a honeypot field: real users never fill it.
 */
export async function submitAccessRequest(
  input: AccessRequestInput & { website?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<AccessRequestResult> {
  try {
    const res = await fetchImpl('/api/v1/access-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email.trim(),
        building: input.building.trim() || undefined,
        website: input.website || undefined,
      }),
    });
    if (res.ok) return { status: 'submitted' };
    if (res.status === 429) return { status: 'rate_limited' };
    if (res.status === 400) return { status: 'invalid' };
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}
