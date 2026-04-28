import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { WebAuthenticationService } from './api';
import { Stack, Text, Button } from '../ui/primitives';
import { ErrorText } from '../ui/primitives/ErrorText';
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
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, refreshAuth, isLoading: authIsLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page user was trying to access (or default to home)
  const from = (location.state as { from?: NavForm })?.from;
  const pathname = from?.pathname || '/';
  const search = from?.search || '';
  const redirect = pathname === "/logout" ? "/" : `${pathname}${search}`;

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

    try {
      const status = await WebAuthenticationService.webAuthControllerGetAccountSetupStatus({ email });
      if (!status.canSetup) {
        setError('That email is not ready for account setup. Ask an admin to create or reset the account.');
        return;
      }
      setEmail(status.email);
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
            <Text tone="muted" className='login__copy'>Enter the email an admin invited or reset for you.</Text>
          </Stack>

          <Stack spacing="4">
            <Stack spacing="2">
              <label htmlFor="setup-email" className="login-label"><Text size="2" weight="medium">Email</Text></label>
              <input id="setup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="login-input" placeholder="name@work.com" required disabled={isLoading} autoComplete="email" />
            </Stack>

            {error && <ErrorText size="2" weight="medium">{error}</ErrorText>}

            <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="login-button">
              {isLoading ? 'Checking...' : 'Continue'}
            </Button>
            <Button type="button" variant="secondary" size="lg" disabled={isLoading} className="login-button" onClick={() => { setMode('sign-in'); setError(''); }}>
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
        </Stack>
      </Stack>
    </form>
  );
}

function readAuthError(err: any, fallback: string) {
  return err?.body?.detail || err?.body?.title || err?.message || fallback;
}
