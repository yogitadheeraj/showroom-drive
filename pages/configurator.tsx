import MarketingPageShell from '../src/components/public/MarketingPageShell';
import CarConfiguratorExperience from '../src/components/public/CarConfiguratorExperience';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthOptional } from '@/hooks/useAuth';
import { ROUTE_ALLOWED_ROLES } from '@/constants/roles';

export default function ConfiguratorPage() {
  const auth = useAuthOptional();
  const isLoggedIn = !!auth?.user;

  if (isLoggedIn) {
    return (
      <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.CONFIGURATOR]}>
        <DashboardLayout>
          <CarConfiguratorExperience />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <MarketingPageShell>
      <CarConfiguratorExperience />
    </MarketingPageShell>
  );
}