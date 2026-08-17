import { useRouter } from 'next/router';
import DashboardPage from '../src/pages/DashboardPage';
export default function UsersPage() {
  const router = useRouter();
  const role = router.query.role || 'all';

  return (
   <DashboardPage />
  );
}
