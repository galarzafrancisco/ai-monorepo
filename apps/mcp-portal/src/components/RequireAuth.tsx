import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../context/SessionContext";

export default function RequireAuth() {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) return null;

  if (!session) {
    const encoded = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${encoded}`} replace />;
  }

  return <Outlet />;
}
