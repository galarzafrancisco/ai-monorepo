import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Stack, Text, Button } from '../ui/primitives';
import { ErrorText } from '../ui/primitives/ErrorText';
import './LoginPage.css';

/**
 * Provides email/password authentication with redirect after successful login
 */
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page user was trying to access (or default to home)
  const from = (location.state as any)?.from?.pathname || '/';
  const redirect = from === "/logout" ? "/" : from;

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

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing="6">
        <Stack spacing="2" align="center">
          <Text size="6" weight="bold">Welcome Back</Text>
          <Text tone="muted">Sign in to your account</Text>
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
              placeholder="you@example.com"
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
        </Stack>
      </Stack>
    </form>
  );
}
