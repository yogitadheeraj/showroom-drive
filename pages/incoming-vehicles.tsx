import ProtectedRoute from '../src/components/ProtectedRoute';
import IncomingVehiclesPage from '../src/pages/IncomingVehiclesPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function IncomingVehiclesRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.INCOMING_VEHICLES]}>
      <IncomingVehiclesPage />
    </ProtectedRoute>
  );
}