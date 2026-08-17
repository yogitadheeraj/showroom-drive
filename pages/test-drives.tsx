import ProtectedRoute from '../src/components/ProtectedRoute';
import TestDrivesPage from '../src/pages/TestDrivesPage';

export default function TestDrivesRoute() {
  return (
    <ProtectedRoute>
      <TestDrivesPage />
    </ProtectedRoute>
  );
}