import ProtectedRoute from '../src/components/ProtectedRoute';
import VehiclesPage from '../src/pages/VehiclesPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function VehiclesRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.VEHICLES]}>
      <VehiclesPage />
    </ProtectedRoute>
  );
}