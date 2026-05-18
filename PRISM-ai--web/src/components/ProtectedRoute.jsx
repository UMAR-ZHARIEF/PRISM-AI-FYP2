import './ProtectedRoute.css';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requireRole }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="protected-route-loading">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!profile?.role || !allowed.includes(profile.role)) {
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
