import ProtectedRoute from '../src/components/ProtectedRoute';
import LocationsPage from '../src/pages/LocationsPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function LocationsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.LOCATIONS]}>
      <LocationsPage />
    </ProtectedRoute>
  );
}