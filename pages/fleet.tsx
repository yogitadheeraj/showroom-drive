import ProtectedRoute from '../src/components/ProtectedRoute';
import SharedVehicleFleetPage from '../src/pages/SharedVehicleFleetPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function FleetRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.FLEET]}>
      <SharedVehicleFleetPage />
    </ProtectedRoute>
  );
}