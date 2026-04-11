import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Component that checks if user needs to see the walkthrough
 * Redirects to /walkthrough if the authenticated user hasn't seen it yet
 */
export function WalkthroughChecker({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Wait for auth to load
  if (isLoading) {
    return null;
  }

  // Not authenticated - let ProtectedRoute handle it
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  // User hasn't seen walkthrough - redirect
  if (!user.hasSeenWalkthrough) {
    return <Navigate to="/walkthrough" replace />;
  }

  // User has seen walkthrough - show children
  return <>{children}</>;
}
