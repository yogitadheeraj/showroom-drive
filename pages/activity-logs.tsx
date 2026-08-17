import ProtectedRoute from '../src/components/ProtectedRoute';
import ActivityLogsPage from '../src/pages/ActivityLogsPage';
import { ROUTE_ALLOWED_ROLES } from '../src/constants/roles';

export default function ActivityLogsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.ACTIVITY_LOGS]}>
      <ActivityLogsPage />
    </ProtectedRoute>
  );
}