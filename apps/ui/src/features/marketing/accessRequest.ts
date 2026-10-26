/**
 * Request-access form logic. Validation is pure so it can be unit tested; the
 * server re-validates everything (bounds mirror apps/backend access-request.limits.ts).
 */
/** Stable values stored by the backend (AccessRequestHeardFrom). '' = not answered. */
export type HeardFrom = '' | 'x' | 'linkedin' | 'word_of_mouth' | 'conference_tshirt' | 'other';

export const HEARD_FROM_OPTIONS: ReadonlyArray<{ value: Exclude<HeardFrom, ''>; label: string }> = [
  { value: 'x', label: 'X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'word_of_mouth', label: 'Word of mouth' },
  { value: 'conference_tshirt', label: 'Saw a T-shirt at a conference' },
  { value: 'other', label: 'Other' },
];

export function heardFromLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return HEARD_FROM_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export interface AccessRequestInput {
  email: string;
  building: string;
  heardFrom?: HeardFrom;
  heardFromOther?: string;
}

export type AccessRequestErrors = Partial<Record<keyof AccessRequestInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const EMAIL_MAX = 254;
export const BUILDING_MAX = 280;
export const HEARD_FROM_OTHER_MAX = 120;

export function validateAccessRequest(input: AccessRequestInput): AccessRequestErrors {
  const errors: AccessRequestErrors = {};
  const email = input.email.trim();
  if (!email) errors.email = 'Enter your email so we know where to reach you.';
  else if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) errors.email = 'That doesn’t look like an email address.';
  if (input.building.trim().length > BUILDING_MAX) {
    errors.building = `Keep it under ${BUILDING_MAX} characters.`;
  }
  if (input.heardFrom === 'other' && (input.heardFromOther ?? '').trim().length > HEARD_FROM_OTHER_MAX) {
    errors.heardFromOther = `Keep it under ${HEARD_FROM_OTHER_MAX} characters.`;
  }
  return errors;
}

export type AccessRequestResult =
  | { status: 'submitted' }
  | { status: 'busy' }
  | { status: 'invalid' }
  | { status: 'error' };

export type AccessRequestPayload = {
  email: string;
  building?: string;
  heardFrom?: Exclude<HeardFrom, ''>;
  heardFromOther?: string;
  website?: string;
};
export type AccessRequestSender = (body: AccessRequestPayload) => Promise<unknown>;

/**
 * Sends the request to the public, write-only endpoint. Returns `submitted`
 * only once the server has confirmed it stored the request. `website` is a
 * honeypot that real people never fill in.
 */
export async function submitAccessRequest(
  input: AccessRequestInput & { website?: string },
  send: AccessRequestSender,
): Promise<AccessRequestResult> {
  try {
    const heardFrom = input.heardFrom || undefined;
    await send({
      email: input.email.trim(),
      building: input.building.trim() || undefined,
      heardFrom,
      // Only "Other" carries free text; anything typed before switching away is dropped.
      heardFromOther: heardFrom === 'other' ? input.heardFromOther?.trim() || undefined : undefined,
      website: input.website || undefined,
    });
    return { status: 'submitted' };
  } catch (err) {
    const status = (err as { status?: unknown } | null)?.status;
    if (status === 429) return { status: 'busy' };
    if (status === 400) return { status: 'invalid' };
    return { status: 'error' };
  }
}

export const FAILURE_MESSAGES: Record<Exclude<AccessRequestResult['status'], 'submitted'>, string> = {
  busy: 'We’re getting a lot of requests right now and couldn’t save yours. Please try again in a little while.',
  invalid: 'We couldn’t accept that. Check your email address and answers, then try again.',
  error: 'Something went wrong and your request was not saved. Please try again.',
};
