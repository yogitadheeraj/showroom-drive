import ProtectedRoute from '../src/components/ProtectedRoute';
import CarBookingsPage from '../src/pages/CarBookingsPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function CarBookingsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.BOOKINGS]}>
      <CarBookingsPage />
    </ProtectedRoute>
  );
}