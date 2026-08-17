import ProtectedRoute from '../src/components/ProtectedRoute';
import EnquiriesPage from '../src/pages/EnquiriesPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function EnquiriesRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.ENQUIRIES]}>
      <EnquiriesPage />
    </ProtectedRoute>
  );
}