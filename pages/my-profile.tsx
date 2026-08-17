import ProtectedRoute from '../src/components/ProtectedRoute';
import MyProfilePage from '../src/pages/MyProfilePage';

export default function MyProfileRoute() {
  return (
    <ProtectedRoute>
      <MyProfilePage />
    </ProtectedRoute>
  );
}