import ProtectedRoute from '../../src/components/ProtectedRoute';
import ReportMonitoringPage from '../../src/pages/ReportMonitoringPage';
import { ROUTE_ALLOWED_ROLES } from '../../src/constants/roles';

export default function ReportsMonitoringRoute() {
  return (
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.REPORTS_MONITORING]}>
      <ReportMonitoringPage />
    </ProtectedRoute>
  );
}