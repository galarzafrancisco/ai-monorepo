/**
 * What the "Create account" step does after the backend's setup-status check.
 * The allowlist decision stays on the backend; `canSetup: false` covers
 * "not invited", "already set up" and "deactivated" alike, so the UI must not
 * claim which one it is.
 */
export type AccountSetupNextStep =
  | { kind: 'setup-account'; email: string }
  | { kind: 'request-access' };

export function accountSetupNextStep(status: { email: string; canSetup: boolean }): AccountSetupNextStep {
  return status.canSetup ? { kind: 'setup-account', email: status.email } : { kind: 'request-access' };
}

/** Router state handed to /join. Kept out of the URL so the email isn't logged or leaked via referrers. */
export type JoinNavigationState = { email: string };

export function joinNavigationState(email: string): JoinNavigationState {
  return { email: email.trim() };
}

/** Reads the email handed over by joinNavigationState; anything else is ignored. */
export function readPrefilledEmail(state: unknown): string {
  const email = (state as { email?: unknown } | null)?.email;
  return typeof email === 'string' ? email.trim().slice(0, 254) : '';
}
