import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function LogoutPage() {

  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const performLogout = async () => {
      await logout();
      // Redirect to login page after logout
      navigate('/login', { replace: true });
    };

    performLogout();
  }, [logout, navigate]);



  return (
    <div className="logout-page">
      <div className="logout-container">
        <div className="logout-card">
          <div className="logout-header">
            <h1 className="logout-title">Logging Out...</h1>
            <p className="logout-subtitle">You are being logged out. Please wait.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
