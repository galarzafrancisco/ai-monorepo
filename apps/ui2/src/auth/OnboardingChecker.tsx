import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { WebAuthenticationService } from './api';

/**
 * Component that checks if onboarding is needed and redirects accordingly
 * Used to wrap the login page - if onboarding is needed, redirect to /onboarding
 */
export function OnboardingChecker({ children }: { children: React.ReactNode }) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const status = await WebAuthenticationService.webAuthControllerGetOnboardingStatus();
        setNeedsOnboarding(status.needsOnboarding);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        // If we can't check, assume we don't need onboarding (fail open)
        setNeedsOnboarding(false);
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

  if (needsOnboarding) {
    // Redirect to onboarding
    return <Navigate to="/onboarding" replace />;
  }

  // Show children (login page)
  return <>{children}</>;
}
