import ProtectedRoute from '../src/components/ProtectedRoute';
import UsersPage from '../src/pages/UsersPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function UsersRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.USERS]}>
      <UsersPage />
    </ProtectedRoute>
  );
}
