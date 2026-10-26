import { describe, expect, it } from 'vitest';
import { accountSetupNextStep, joinNavigationState, readPrefilledEmail } from './accountSetup';

describe('accountSetupNextStep', () => {
  it('keeps the normal onboarding for invited emails', () => {
    expect(accountSetupNextStep({ email: 'a@b.dev', canSetup: true })).toEqual({ kind: 'setup-account', email: 'a@b.dev' });
  });

  it('offers a path to request access instead of a dead end', () => {
    expect(accountSetupNextStep({ email: 'a@b.dev', canSetup: false })).toEqual({ kind: 'request-access' });
  });
});

describe('create account -> /join handoff', () => {
  it('round-trips the email through router state, not the URL', () => {
    const state = joinNavigationState('  Person@Example.com ');
    expect(state).toEqual({ email: 'Person@Example.com' });
    expect(readPrefilledEmail(state)).toBe('Person@Example.com');
  });

  it('ignores missing or malformed state and bounds the length', () => {
    expect(readPrefilledEmail(null)).toBe('');
    expect(readPrefilledEmail({ email: 42 })).toBe('');
    expect(readPrefilledEmail({ email: 'x'.repeat(1000) })).toHaveLength(254);
  });
});
