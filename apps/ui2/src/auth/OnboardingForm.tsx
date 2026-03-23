import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Stack, Text, Button } from '../ui/primitives';
import { ErrorText } from '../ui/primitives/ErrorText';
import './LoginPage.css';
import { WebAuthenticationService } from './api';

/**
 * Onboarding form for creating the first admin user
 */
export function OnboardingForm() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { refreshAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Create first admin user
      await WebAuthenticationService.webAuthControllerOnboard({
        email,
        displayName,
        slug,
        password,
      });

      // Refresh auth context to get the logged-in user
      await refreshAuth();

      // Navigate to home
      navigate('/', { replace: true });
    } catch (err: any) {
      // Extract error message from RFC 7807 Problem Details response
      let errorMessage = 'Failed to create admin user';

      if (err.body?.context?.fields && Array.isArray(err.body.context.fields)) {
        // Use field-specific validation errors if available
        errorMessage = err.body.context.fields.join(', ');
      } else if (err.body?.detail) {
        // Use the detailed error message from the Problem Details response
        errorMessage = err.body.detail;
      } else if (err.body?.title) {
        // Fallback to the error title
        errorMessage = err.body.title;
      } else if (err.message) {
        // Fallback to the generic error message
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing="6">
        <Stack spacing="2" align="center">
          <Text size="6" weight="bold" className='login__copy'>Welcome to Taico</Text>
          <Text tone="muted" className='login__copy'>
            Let's set up your first admin account to get started.
          </Text>
        </Stack>

        <Stack spacing="4">
          <Stack spacing="2">
            <label htmlFor="displayName" className="login-label">
              <Text size="2" weight="medium">Display Name</Text>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="login-input"
              placeholder="Admin User"
              required
              disabled={isLoading}
              autoComplete="name"
            />
          </Stack>

          <Stack spacing="2">
            <label htmlFor="slug" className="login-label">
              <Text size="2" weight="medium">Username</Text>
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="login-input"
              placeholder="admin"
              required
              disabled={isLoading}
              autoComplete="username"
            />
          </Stack>

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
              placeholder="admin@example.com"
              required
              disabled={isLoading}
              autoComplete="email"
            />
            <Text size="1" tone="muted">
              Email is not verified and cannot be changed later. Make sure it's correct.
            </Text>
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
              autoComplete="new-password"
            />
            <Text size="1" tone="muted">
              Remember this password - you won't receive a confirmation email.
            </Text>
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
            {isLoading ? 'Creating account...' : 'Create Admin Account'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
