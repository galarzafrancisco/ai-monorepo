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
  const [retryInSeconds, setRetryInSeconds] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;
    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let retryCountdownId: ReturnType<typeof setInterval> | undefined;

    const clearRetryTimers = () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }

      if (retryCountdownId) {
        clearInterval(retryCountdownId);
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
        setRetryInSeconds(null);
      } catch (err) {
        if (!isActive) {
          return;
        }

        console.error('Failed to check onboarding status:', err);
        setError(err instanceof Error ? err : new Error('Failed to check onboarding status'));
        setNeedsOnboarding(null);
        setRetryCount((current) => current + 1);
        setRetryInSeconds(RETRY_INTERVAL_SECONDS);

        retryCountdownId = setInterval(() => {
          setRetryInSeconds((current) => {
            if (current === null || current <= 1) {
              return 0;
            }

            return current - 1;
          });
        }, 1000);

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
    const retryLabel = retryInSeconds === null ? 'Retrying soon...' : `Retrying in ${retryInSeconds}s`;

    return (
      <div className="onboarding-checker-error">
        <Stack spacing="4" align="center">
          <Text size="5" weight="semibold" as="div">
            Still waking things up...
          </Text>
          <Text size="3" as="div">
            We are trying to reach your Taico app, but it has not answered yet.
          </Text>
          <Text size="2" tone="muted" as="div">
            No action needed - we will keep checking automatically.
          </Text>
          <Text size="2" tone="muted" as="div" className="onboarding-checker-feedback">
            {retryLabel} (attempt {retryCount})
            <span className="onboarding-checker-dots" aria-hidden="true" />
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
