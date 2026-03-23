import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';
import GRODashboard from '@/components/dashboards/GRODashboard';
import SalesDashboard from '@/components/dashboards/SalesDashboard';
import SecurityDashboard from '@/components/dashboards/SecurityDashboard';

const DashboardPage = () => {
  const { role } = useAuth();

  const renderDashboard = () => {
    switch (role) {
      case 'superadmin': return <SuperAdminDashboard />;
      case 'gro': return <GRODashboard />;
      case 'sales': return <SalesDashboard />;
      case 'security': return <SecurityDashboard />;
      default: return <SalesDashboard />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
};

export default DashboardPage;
