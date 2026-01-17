import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { WebAuthenticationService, type AuthUser } from './api';
import { AuthContext, type AuthState } from './auth-context';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    WebAuthenticationService.webAuthControllerMe()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        const response = await WebAuthenticationService.webAuthControllerRefresh();
        setUser(response.user);
      } catch (error) {
        console.error('Token refresh failed:', error);
        setUser(null);
      }
    }, 8 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await WebAuthenticationService.webAuthControllerLogin({ email, password });
    setUser(response.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await WebAuthenticationService.webAuthControllerLogout();
    } finally {
      setUser(null);
    }
  };

  const refreshAuth = async (): Promise<void> => {
    const response = await WebAuthenticationService.webAuthControllerRefresh();
    setUser(response.user);
  };

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
