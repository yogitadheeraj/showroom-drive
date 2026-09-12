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
import { Divide } from 'lucide-react';

const DashboardPage = () => {
  const { role } = useAuth();

  const renderDashboard = () => {
    switch (role) {
      case APP_ROLE.SUPERADMIN:  
      case APP_ROLE.DEALER_ADMIN: 
        return (
          <div className="mt-4 sm:mb-6">
            <SuperAdminDashboard />
             <Divide className="mx-2 h-6 w-[1px] text-border/50" />
            <FollowUpOverview />
          </div>
        );
      case APP_ROLE.SALES_ADMIN:  
        return (
          <div className="mt-4 sm:mb-6">
            <BranchAdminDashboard />
             <Divide className="mx-2 h-6 w-[1px] text-border/50" />
            <FollowUpOverview />
          </div>
        );
      case APP_ROLE.SERVICE_EXPERT:
      case APP_ROLE.GRO:          return (
          <GRODashboard />
      );
      case APP_ROLE.SALES:        
        return (
          <div className="inline-block gap-2 sm:mb-6 divider-y divide-border/50">
            <SalesDashboard />
            <Divide className="mx-2 h-6 w-[1px] text-border/50" />
            <FollowUpOverview />
          </div>
        );
      case APP_ROLE.SECURITY:     return <SecurityDashboard />;
      default:                    return  <div className="inline-block gap-2 sm:mb-6 divider-y divide-border/50">
            <SalesDashboard />
            <Divide className="mx-2 h-6 w-[1px] text-border/50" />
            <FollowUpOverview />
          </div>;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
      
    </DashboardLayout>
  );

  
};

export default DashboardPage;
