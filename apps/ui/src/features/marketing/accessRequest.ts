/**
 * Request-access form logic. Pure and transport-free so it can be unit tested
 * and wired to a real endpoint later without touching the UI.
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
  | { status: 'not_connected' };

/**
 * PLACEHOLDER. Nothing is sent, stored, emailed or queued.
 * Replace the body with a real call (e.g. POST /api/v1/access-requests) and
 * return `{ status: 'submitted' }` only once the server confirms.
 */
export async function submitAccessRequest(input: AccessRequestInput): Promise<AccessRequestResult> {
  void input; // unused until wired to a real endpoint
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { status: 'not_connected' };
}
