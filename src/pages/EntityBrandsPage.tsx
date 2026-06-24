import DashboardLayout from '@/components/DashboardLayout';
import BrandSettings from '@/components/settings/BrandSettings';
import { ENTITY_ORCHESTRATION, ENTITY_ORCHESTRATION_LABEL } from '@/constants/entityOrchestration';

const EntityBrandsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{ENTITY_ORCHESTRATION.entity} {ENTITY_ORCHESTRATION.brands}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your {ENTITY_ORCHESTRATION.brands.toLowerCase()} and branding setup. Orchestration: {ENTITY_ORCHESTRATION_LABEL}</p>
        </div>

        <BrandSettings />
      </div>
    </DashboardLayout>
  );
};

export default EntityBrandsPage;
