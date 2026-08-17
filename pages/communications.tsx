import ProtectedRoute from '../src/components/ProtectedRoute';
import CommunicationsPage from '../src/pages/CommunicationsPage';

export default function CommunicationsRoute() {
  return (
    <ProtectedRoute>
      <CommunicationsPage />
    </ProtectedRoute>
  );
}