import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { WebAuthenticationService } from './api';
import { Stack } from '../ui/primitives/Stack';
import { Text } from '../ui/primitives/Text';
import { Button } from '../ui/primitives/Button';
import './OnboardingChecker.css';

/**
 * Component that checks if onboarding is needed and redirects accordingly
 * Used to wrap the login page - if onboarding is needed, redirect to /onboarding
 */
export function OnboardingChecker({ children }: { children: React.ReactNode }) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const status = await WebAuthenticationService.webAuthControllerGetOnboardingStatus();
        setNeedsOnboarding(status.needsOnboarding);
        setError(null);
      } catch (err) {
        console.error('Failed to check onboarding status:', err);
        setError(err instanceof Error ? err : new Error('Failed to check onboarding status'));
        // Fail closed - redirect to onboarding if we can't determine status
        setNeedsOnboarding(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  if (isLoading) {
    // Show nothing while checking (could add a spinner here)
    return null;
  }

  if (error) {
    // Show error state with retry button
    return (
      <div className="onboarding-checker-error">
        <Stack spacing="4" align="center">
          <Text size="5" weight="semibold" as="div">
            Unable to Check System Status
          </Text>
          <Text size="3" as="div">
            Could not determine if the system needs initial setup.
          </Text>
          <Text size="2" tone="muted" as="div">
            {error.message}
          </Text>
          <Button onClick={() => window.location.reload()} variant="primary">
            Retry
          </Button>
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
