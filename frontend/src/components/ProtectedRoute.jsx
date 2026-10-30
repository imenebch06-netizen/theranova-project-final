import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, roleHome } from "../contexts/AuthContext";
import { LoadingScreen } from "./ui/Feedback";

export default function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?next=${next}`} replace />;
  }
  if (roles && !roles.includes(role)) {
    return <Navigate to={roleHome(role)} replace />;
  }
  return children;
}
