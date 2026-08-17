import ProtectedRoute from '../src/components/ProtectedRoute';
import WalkinPage from '../src/pages/WalkinPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function WalkinRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.WALKIN]}>
      <WalkinPage />
    </ProtectedRoute>
  );
}