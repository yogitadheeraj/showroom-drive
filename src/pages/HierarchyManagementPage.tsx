import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import HierarchyDashboard from '@/components/hierarchy/HierarchyDashboard';

const HierarchyManagementPage = () => {
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('orgId') || '';
  const orgCode = searchParams.get('orgCode') || '';

  return (
    <DashboardLayout>
      <HierarchyDashboard orgId={orgId} preferredOrgCode={orgCode} />
    </DashboardLayout>
  );
};

export default HierarchyManagementPage;