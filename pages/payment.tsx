import ProtectedRoute from '../src/components/ProtectedRoute';
import PaymentPage from '../src/pages/PaymentPage';

export default function PaymentRoute() {
  return (
    <ProtectedRoute>
      <PaymentPage />
    </ProtectedRoute>
  );
}