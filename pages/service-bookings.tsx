import ProtectedRoute from '../src/components/ProtectedRoute';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';
import ServiceBookingsPage from '../src/pages/ServiceBookingsPage';

export default function ServiceBookingsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.BOOKINGS]}>
      <ServiceBookingsPage />
    </ProtectedRoute>
  );
}
