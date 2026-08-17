import ProtectedRoute from '../src/components/ProtectedRoute';
import DataCenterPage from '../src/pages/DataCenterPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function DataCenterRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.DATA_CENTER]}>
      <DataCenterPage />
    </ProtectedRoute>
  );
}