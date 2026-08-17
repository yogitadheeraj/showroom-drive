import ProtectedRoute from '../src/components/ProtectedRoute';
import FollowUpsPage from '../src/pages/FollowUpsPage';

export default function FollowUpsRoute() {
  return (
    <ProtectedRoute>
      <FollowUpsPage />
    </ProtectedRoute>
  );
}