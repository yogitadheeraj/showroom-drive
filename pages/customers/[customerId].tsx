import ProtectedRoute from '../../src/components/ProtectedRoute';
import CustomersPage from '../../src/pages/CustomersPage';
import { ROUTE_ALLOWED_ROLES } from '../../src/constants/roles';

export default function CustomerDetailsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.BOOKINGS]}>
      <CustomersPage />
    </ProtectedRoute>
  );
}
