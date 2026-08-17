import ProtectedRoute from '../../src/components/ProtectedRoute';
import AIReportsPage from '../../src/pages/AIReportsPage';
import { ROUTE_ALLOWED_ROLES } from '../../src/constants/roles';

export default function AIInsightsRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.REPORTS_MONITORING]}>
      <AIReportsPage />
    </ProtectedRoute>
  );
}