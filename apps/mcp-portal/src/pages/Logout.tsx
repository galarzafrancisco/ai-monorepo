import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../config/api";

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const logout = async () => {
      try {
        await fetch(`${getApiBaseUrl()}/api/v1/logout`, {
          method: "POST",
          credentials: "include",
        });
      } finally {
        navigate("/login", { replace: true });
      }
    };
    logout();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white/60">Logging out...</p>
    </div>
  );
}
