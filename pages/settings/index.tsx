import ProtectedRoute from '../../src/components/ProtectedRoute';
import DealerSettingsPage from '../../src/pages/DealerSettingsPage';
import { ROUTE_ALLOWED_ROLES } from '../../src/constants/roles';

export default function SettingsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.SETTINGS]}>
      <DealerSettingsPage />
    </ProtectedRoute>
  );
}