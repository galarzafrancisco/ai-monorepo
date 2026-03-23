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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Unable to Check System Status</h2>
        <p>Could not determine if the system needs initial setup.</p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
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
