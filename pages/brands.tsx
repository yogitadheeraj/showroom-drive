import ProtectedRoute from '../src/components/ProtectedRoute';
import BrandsPage from '../src/pages/BrandsPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function BrandsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.BRANDS]}>
      <BrandsPage />
    </ProtectedRoute>
  );
}