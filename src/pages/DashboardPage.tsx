import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';
import GRODashboard from '@/components/dashboards/GRODashboard';
import SalesDashboard from '@/components/dashboards/SalesDashboard';
import SecurityDashboard from '@/components/dashboards/SecurityDashboard';
import BranchAdminDashboard from '@/components/dashboards/BranchAdminDashboard';
import FollowUpOverview from '@/components/dashboards/FollowUpOverview';
import HierarchyOverview from '@/components/dashboards/HierarchyOverview';
import { APP_ROLE } from '@/constants/roles';

const DashboardPage = () => {
  const { role } = useAuth();

  const renderDashboard = () => {
    switch (role) {
      case APP_ROLE.SUPERADMIN:  
      case APP_ROLE.DEALER_ADMIN: 
       return <SuperAdminDashboard />;
      case APP_ROLE.SALES_ADMIN:  return <BranchAdminDashboard />;
      case APP_ROLE.SERVICE_EXPERT:
      case APP_ROLE.GRO:          return <GRODashboard />;
      case APP_ROLE.SALES:        return <SalesDashboard />;
      case APP_ROLE.SECURITY:     return <SecurityDashboard />;
      default:                    return <SalesDashboard />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
       <div className="mt-4 sm:mb-6">
        <FollowUpOverview />
      </div>
    </DashboardLayout>
  );

  
};

export default DashboardPage;
