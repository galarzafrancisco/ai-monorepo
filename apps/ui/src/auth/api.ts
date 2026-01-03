/**
 * Frontend authentication API client
 * Uses httpOnly cookies for token storage (set by backend)
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'standard';
}

/**
 * Authentication API methods
 * All requests include credentials: 'include' to send httpOnly cookies
 */
export const authApi = {
  /**
   * Login with email and password
   * Backend sets access_token and refresh_token httpOnly cookies
   */
  login: async (email: string, password: string): Promise<AuthUser> => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    return data.user; // Extract user from LoginResponseDto
  },

  /**
   * Logout current user
   * Backend clears httpOnly cookies
   */
  logout: async (): Promise<void> => {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  },

  /**
   * Get current authenticated user
   * Uses access_token cookie automatically sent by browser
   */
  getCurrentUser: async (): Promise<AuthUser> => {
    const response = await fetch('/api/v1/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    // /me endpoint returns UserResponseDto directly
    return await response.json();
  },

  /**
   * Refresh access token using refresh_token cookie
   * Backend sets new access_token and refresh_token httpOnly cookies
   */
  refresh: async (): Promise<AuthUser> => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();
    return data.user; // Extract user from LoginResponseDto
  },
};
