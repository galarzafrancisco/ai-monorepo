import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { WebAuthenticationService } from './api';
import { Stack } from '../ui/primitives/Stack';
import { Text } from '../ui/primitives/Text';
import './OnboardingChecker.css';

const RETRY_INTERVAL_SECONDS = 4;

/**
 * Component that checks if onboarding is needed and redirects accordingly
 * Used to wrap the login page - if onboarding is needed, redirect to /onboarding
 */
export function OnboardingChecker({ children }: { children: React.ReactNode }) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isActive = true;
    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const clearRetryTimers = () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };

    const checkOnboardingStatus = async () => {
      try {
        const status = await WebAuthenticationService.webAuthControllerGetOnboardingStatus();

        if (!isActive) {
          return;
        }

        clearRetryTimers();
        setNeedsOnboarding(status.needsOnboarding);
        setError(null);
      } catch (err) {
        if (!isActive) {
          return;
        }

        console.error('Failed to check onboarding status:', err);
        setError(err instanceof Error ? err : new Error('Failed to check onboarding status'));
        setNeedsOnboarding(null);
        setRetryCount((current) => current + 1);

        retryTimeoutId = setTimeout(() => {
          clearRetryTimers();

          if (!isActive) {
            return;
          }

          void checkOnboardingStatus();
        }, RETRY_INTERVAL_SECONDS * 1000);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void checkOnboardingStatus();

    return () => {
      isActive = false;
      clearRetryTimers();
    };
  }, []);

  if (isLoading) {
    // Show nothing while checking (could add a spinner here)
    return null;
  }

  if (error) {
    return (
      <div className="onboarding-checker-shell">
        <Stack spacing="4" align="center" className="onboarding-checker-card">
          <span className="onboarding-checker-signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <Text size="5" weight="semibold" as="div">
            Reconnecting to Taico...
          </Text>
          <Text size="3" tone="muted" as="div" className="onboarding-checker-copy">
            The backend is not responding yet. We will keep retrying until it is back.
          </Text>
          <Text size="1" tone="muted" as="div" className="onboarding-checker-feedback">
            Retry attempt {retryCount}
          </Text>
        </Stack>
      </div>
    );
  }

  if (needsOnboarding) {
    // Redirect to onboarding
    return <Navigate to="/onboarding" replace />;
  }

  // Show children (login page)
  return <>{children}</>;
}
