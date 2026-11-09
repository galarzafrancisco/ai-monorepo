import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { WebAuthenticationService } from './api';
import { Stack, Text, Button } from '../ui/primitives';
import { ErrorText } from '../ui/primitives/ErrorText';
import { accountSetupNextStep, joinNavigationState } from './accountSetup';
import './LoginPage.css';

export type NavForm = {
  hash: string,
  key: string,
  pathname: string,
  search: string,
  state?: string,
}

/**
 * Provides email/password authentication with redirect after successful login
 */
export function LoginForm() {
  const [mode, setMode] = useState<'sign-in' | 'setup-email' | 'setup-account'>('sign-in');
  const [email, setEmail] = useState('');
  // One-time setup code from the link an operator gave (`/login?setup=…&email=…`).
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [offerRequestAccess, setOfferRequestAccess] = useState(false);

  const { login, refreshAuth, isLoading: authIsLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page user was trying to access (or default to home)
  const from = (location.state as { from?: NavForm })?.from;
  const pathname = from?.pathname || '/';
  const search = from?.search || '';
  const redirect = pathname === "/logout" ? "/" : `${pathname}${search}`;

  // A setup link opens account setup with the code filled in. The code is
  // taken out of the address bar at once so it isn't kept in history.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const setupCode = params.get('setup');
    if (!setupCode) return;
    setCode(setupCode);
    setEmail(params.get('email') ?? '');
    setMode('setup-email');
    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: location.state });
  }, []);

  // If we are already authenticated, redirect
  useEffect(() => {
    if (!authIsLoading && isAuthenticated) {
      console.log("you're in mate");
      navigate(redirect);
    }
  }, [authIsLoading, isAuthenticated, redirect]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      // Redirect to original destination or home
      navigate(redirect, { replace: true });
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setOfferRequestAccess(false);

    try {
      const status = await WebAuthenticationService.webAuthControllerGetAccountSetupStatus({ email, code: setupCodeFrom(code) });
      const next = accountSetupNextStep(status);
      if (next.kind === 'request-access') {
        setOfferRequestAccess(true);
        return;
      }
      setEmail(next.email);
      setMode('setup-account');
    } catch (err: any) {
      setError(readAuthError(err, 'Could not check that email.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await WebAuthenticationService.webAuthControllerSetupAccount({
        email,
        code: setupCodeFrom(code),
        displayName,
        slug,
        password,
      });
      await refreshAuth();
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(readAuthError(err, 'Failed to set up account.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'setup-email') {
    return (
      <form onSubmit={handleSetupEmail}>
        <Stack spacing="6">
          <Stack spacing="2" align="center">
            <Text size="6" weight="bold" className='login__copy'>Create account</Text>
            <Text tone="muted" className='login__copy'>Use the setup link an admin gave you, or enter its email and code.</Text>
          </Stack>

          <Stack spacing="4">
            <Stack spacing="2">
              <label htmlFor="setup-email" className="login-label"><Text size="2" weight="medium">Email</Text></label>
              <input id="setup-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setOfferRequestAccess(false); }} className="login-input" placeholder="name@work.com" required disabled={isLoading} autoComplete="email" />
            </Stack>

            <Stack spacing="2">
              <label htmlFor="setup-code" className="login-label"><Text size="2" weight="medium">Setup code</Text></label>
              <input id="setup-code" type="text" value={code} onChange={(e) => { setCode(e.target.value); setOfferRequestAccess(false); }} className="login-input" placeholder="From your setup link" required disabled={isLoading} autoComplete="one-time-code" />
            </Stack>

            {error && <ErrorText size="2" weight="medium">{error}</ErrorText>}

            {offerRequestAccess && (
              <div className="login-request-access" role="status">
                <Text size="2" weight="semibold">That email and code don’t match an account waiting to be set up.</Text>
                <Text size="2" tone="muted">
                  Check the link you were given: codes work once and expire after 7 days. If you already have an account, sign in instead. Otherwise, tell us you’re interested and we’ll take a look.
                </Text>
                <Button type="button" variant="primary" size="lg" className="login-button" onClick={() => navigate('/join', { state: joinNavigationState(email) })}>
                  Request early access
                </Button>
              </div>
            )}

            {!offerRequestAccess && (
              <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="login-button">
                {isLoading ? 'Checking...' : 'Continue'}
              </Button>
            )}
            <Button type="button" variant="secondary" size="lg" disabled={isLoading} className="login-button" onClick={() => { setMode('sign-in'); setError(''); setOfferRequestAccess(false); }}>
              Back to sign in
            </Button>
          </Stack>
        </Stack>
      </form>
    );
  }

  if (mode === 'setup-account') {
    return (
      <form onSubmit={handleSetupAccount}>
        <Stack spacing="6">
          <Stack spacing="2" align="center">
            <Text size="6" weight="bold" className='login__copy'>Set up account</Text>
            <Text tone="muted" className='login__copy'>Finish your profile and create a password for {email}.</Text>
          </Stack>

          <Stack spacing="4">
            <Stack spacing="2">
              <label htmlFor="setup-display-name" className="login-label"><Text size="2" weight="medium">Display name</Text></label>
              <input id="setup-display-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="login-input" placeholder="Jane User" required disabled={isLoading} autoComplete="name" />
            </Stack>
            <Stack spacing="2">
              <label htmlFor="setup-slug" className="login-label"><Text size="2" weight="medium">Username</Text></label>
              <input id="setup-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="login-input" placeholder="jane" required disabled={isLoading} autoComplete="username" />
            </Stack>
            <Stack spacing="2">
              <label htmlFor="setup-password" className="login-label"><Text size="2" weight="medium">Password</Text></label>
              <input id="setup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" placeholder="••••••••" required disabled={isLoading} autoComplete="new-password" />
            </Stack>

            {error && <ErrorText size="2" weight="medium">{error}</ErrorText>}

            <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="login-button">
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
            <Button type="button" variant="secondary" size="lg" disabled={isLoading} className="login-button" onClick={() => { setMode('setup-email'); setError(''); }}>
              Use a different email
            </Button>
          </Stack>
        </Stack>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing="6">
        <Stack spacing="2" align="center">
          <Text size="6" weight="bold" className='login__copy'>Taico</Text>
          <Text tone="muted" className='login__copy'>
            Where people and agents collaborate in threads, using shared context to get work done.
          </Text>
        </Stack>

        <Stack spacing="4">
          <Stack spacing="2">
            <label htmlFor="email" className="login-label">
              <Text size="2" weight="medium">Email</Text>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="name@work.com"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </Stack>

          <Stack spacing="2">
            <label htmlFor="password" className="login-label">
              <Text size="2" weight="medium">Password</Text>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="••••••••"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </Stack>

          {error && (
            <ErrorText size="2" weight="medium" className="">
              {error}
            </ErrorText>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="login-button"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={isLoading}
            className="login-button"
            onClick={() => { setMode('setup-email'); setError(''); setPassword(''); }}
          >
            Create account
          </Button>
          <Link to="/marketing" className="login-about-link">What is Taico?</Link>
        </Stack>
      </Stack>
    </form>
  );
}

function readAuthError(err: any, fallback: string) {
  return err?.body?.detail || err?.body?.title || err?.message || fallback;
}

/** Accepts a pasted setup link as well as the bare code. */
export function setupCodeFrom(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).searchParams.get('setup') ?? trimmed;
  } catch {
    return trimmed;
  }
}
