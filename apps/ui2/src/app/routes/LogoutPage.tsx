import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';

/**
 * LogoutPage component
 * Automatically logs out the user and redirects to login page
 */
export function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
      } finally {
        // Always redirect to login, even if logout API call fails
        navigate('/login', { replace: true });
      }
    };

    performLogout();
  }, [logout, navigate]);

  return null;
}
