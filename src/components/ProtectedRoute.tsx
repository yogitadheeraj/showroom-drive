import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoadingState from '@/components/common/LoadingState';
import { AppRole } from '@/constants/roles';
import useBrowserPath from '@/hooks/useBrowserPath';
import { navigateTo } from '@/lib/browserNavigation';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();
  const location = useBrowserPath();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigateTo(`/auth?from=${encodeURIComponent(location)}`, true);
      return;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
      navigateTo('/dashboard', true);
    }
  }, [allowedRoles, loading, location, role, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Checking your session..." className="py-0" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
