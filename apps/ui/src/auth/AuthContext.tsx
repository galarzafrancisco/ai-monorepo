import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from './api';

/**
 * Authentication state interface
 */
interface AuthState {
  /** Current authenticated user, null if not authenticated */
  user: AuthUser | null;
  /** Whether a user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether the initial auth check is in progress */
  isLoading: boolean;
  /** Login with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Logout current user */
  logout: () => Promise<void>;
  /** Manually refresh authentication token */
  refreshAuth: () => Promise<void>;
}

/**
 * Auth context - provides authentication state throughout the app
 */
export const AuthContext = createContext<AuthState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component
 * Manages global authentication state and provides auth methods to the app
 *
 * Features:
 * - Checks authentication on mount
 * - Auto-refreshes tokens every 8 minutes (before 10-min expiration)
 * - Provides login, logout, and manual refresh methods
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    authApi
      .getCurrentUser()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        // Not authenticated or session expired
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Auto-refresh tokens every 8 minutes (before 10-min expiration)
  // Only runs when user is authenticated
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(
      async () => {
        try {
          const userData = await authApi.refresh();
          setUser(userData);
        } catch (error) {
          // Refresh failed - user needs to re-authenticate
          console.error('Token refresh failed:', error);
          setUser(null);
        }
      },
      8 * 60 * 1000, // 8 minutes
    );

    return () => clearInterval(refreshInterval);
  }, [user]);

  /**
   * Login with email and password
   * Sets httpOnly cookies and updates user state
   */
  const login = async (email: string, password: string): Promise<void> => {
    const userData = await authApi.login(email, password);
    setUser(userData);
  };

  /**
   * Logout current user
   * Clears httpOnly cookies and resets user state
   */
  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      // Always clear user state, even if API call fails
      setUser(null);
    }
  };

  /**
   * Manually refresh authentication token
   * Useful for recovering from temporary network issues
   */
  const refreshAuth = async (): Promise<void> => {
    const userData = await authApi.refresh();
    setUser(userData);
  };

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 *
 * @throws Error if used outside AuthProvider
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, login, logout } = useAuth();
 *   // ...
 * }
 * ```
 */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
