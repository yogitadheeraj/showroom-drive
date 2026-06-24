import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Network, Settings, BarChart3, AlertCircle, Layers3, Sparkles } from 'lucide-react';
import { OrganizationManager } from './OrganizationManager';
import { BusinessUnitManager, SalesOfficeManager, PlantManager, LocationManager, VehicleManager } from './HierarchyManagement';
import { RoleManager, RoleAssignmentManager, AuditLogViewer, WebhookManager } from './AdvancedFeatures';
import { hierarchyGet } from './hierarchyApi';

interface HierarchyDashboardProps {
  orgId?: string;
  preferredOrgCode?: string;
}

/**
 * Main Hierarchy Management Dashboard
 * Provides unified interface for:
 * - Organization structure
 * - Business units, sales offices, plants
 * - Role management
 * - Audit logs
 * - Webhooks
 * - Reporting
 */
export const HierarchyDashboard: React.FC<HierarchyDashboardProps> = ({ orgId = '', preferredOrgCode = '' }) => {
  const [selectedOrg, setSelectedOrg] = useState(orgId);
  const [selectedBU, setSelectedBU] = useState('');
  const [selectedSO, setSelectedSO] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectionNames, setSelectionNames] = useState({
    org: 'Not selected',
    businessUnit: 'Not selected',
    salesOffice: 'Not selected',
    plant: 'Not selected',
    location: 'Not selected',
  });

  const handleSelectOrg = (nextOrgId: string) => {
    setSelectedOrg(nextOrgId);
    setSelectedBU('');
    setSelectedSO('');
    setSelectedPlant('');
    setSelectedLocation('');
  };

  const handleSelectBusinessUnit = (nextBusinessUnitId: string) => {
    setSelectedBU(nextBusinessUnitId);
    setSelectedSO('');
    setSelectedPlant('');
    setSelectedLocation('');
  };

  const handleSelectSalesOffice = (nextSalesOfficeId: string) => {
    setSelectedSO(nextSalesOfficeId);
    setSelectedPlant('');
    setSelectedLocation('');
  };

  const handleSelectPlant = (nextPlantId: string) => {
    setSelectedPlant(nextPlantId);
    setSelectedLocation('');
  };

  const summarizeId = (value: string) => {
    if (!value) return 'Not selected';
    if (value.length <= 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const entityLabel = (entity: unknown, fallbackId: string, fields: string[]) => {
    if (!fallbackId) return 'Not selected';
    if (!entity || typeof entity !== 'object') return summarizeId(fallbackId);

    for (const field of fields) {
      const value = (entity as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return summarizeId(fallbackId);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchSelectionNames = async () => {
      try {
        const [org, businessUnit, salesOffice, plant, location] = await Promise.all([
          selectedOrg ? hierarchyGet<Record<string, unknown>>(`/api/v1/organizations/${encodeURIComponent(selectedOrg)}`).catch(() => null) : Promise.resolve(null),
          selectedBU ? hierarchyGet<Record<string, unknown>>(`/api/v1/business-units/${encodeURIComponent(selectedBU)}`).catch(() => null) : Promise.resolve(null),
          selectedSO ? hierarchyGet<Record<string, unknown>>(`/api/v1/sales-offices/${encodeURIComponent(selectedSO)}`).catch(() => null) : Promise.resolve(null),
          selectedPlant ? hierarchyGet<Record<string, unknown>>(`/api/v1/plants/${encodeURIComponent(selectedPlant)}`).catch(() => null) : Promise.resolve(null),
          selectedLocation ? hierarchyGet<Record<string, unknown>>(`/api/v1/locations/${encodeURIComponent(selectedLocation)}`).catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setSelectionNames({
          org: entityLabel(org, selectedOrg, ['name', 'orgName', 'code']),
          businessUnit: entityLabel(businessUnit, selectedBU, ['name', 'code']),
          salesOffice: entityLabel(salesOffice, selectedSO, ['name', 'salesOfficeCode']),
          plant: entityLabel(plant, selectedPlant, ['name', 'plantCode']),
          location: entityLabel(location, selectedLocation, ['name', 'locationCode']),
        });
      } catch {
        if (cancelled) return;
        setSelectionNames({
          org: summarizeId(selectedOrg),
          businessUnit: summarizeId(selectedBU),
          salesOffice: summarizeId(selectedSO),
          plant: summarizeId(selectedPlant),
          location: summarizeId(selectedLocation),
        });
      }
    };

    void fetchSelectionNames();
    return () => {
      cancelled = true;
    };
  }, [selectedOrg, selectedBU, selectedSO, selectedPlant, selectedLocation]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -top-14 -right-16 h-48 w-48 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="absolute -bottom-16 -left-20 h-52 w-52 rounded-full bg-emerald-300/10 blur-2xl" />
        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
            <Sparkles className="h-3.5 w-3.5" /> Enterprise Control Center
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold flex items-center gap-3">
            <Network className="w-8 h-8 md:w-10 md:h-10 text-sky-300" /> Hierarchy Management
          </h1>
          <p className="max-w-3xl text-sm md:text-base text-slate-200">
            Manage organization structure, operational hierarchy, role assignment, monitoring, and integrations from one workspace.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary" className="bg-white/15 text-white border-transparent">Structure</Badge>
            <Badge variant="secondary" className="bg-white/15 text-white border-transparent">Role Governance</Badge>
            <Badge variant="secondary" className="bg-white/15 text-white border-transparent">Audit Visibility</Badge>
            <Badge variant="secondary" className="bg-white/15 text-white border-transparent">Integration Controls</Badge>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Layers3 className="w-4 h-4" /> Active Selection Context</CardTitle>
          <CardDescription>Current scope used for hierarchy operations and role assignment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
            <div className="rounded-lg border bg-muted/40 p-2"><p className="text-muted-foreground">Organization</p><p className="font-medium">{selectionNames.org}</p></div>
            <div className="rounded-lg border bg-muted/40 p-2"><p className="text-muted-foreground">Business Unit</p><p className="font-medium">{selectionNames.businessUnit}</p></div>
            <div className="rounded-lg border bg-muted/40 p-2"><p className="text-muted-foreground">Sales Office</p><p className="font-medium">{selectionNames.salesOffice}</p></div>
            <div className="rounded-lg border bg-muted/40 p-2"><p className="text-muted-foreground">Plant</p><p className="font-medium">{selectionNames.plant}</p></div>
            <div className="rounded-lg border bg-muted/40 p-2"><p className="text-muted-foreground">Location</p><p className="font-medium">{selectionNames.location}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="structure" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Structure
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Network className="w-4 h-4" /> Hierarchy
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Monitoring
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Integrations
          </TabsTrigger>
        </TabsList>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Organizational Structure</CardTitle>
              <CardDescription>View and manage all organizations in the system</CardDescription>
            </CardHeader>
            <CardContent>
                <OrganizationManager selectedOrgId={selectedOrg} preferredOrgCode={preferredOrgCode} onSelectOrg={handleSelectOrg} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
            {selectedOrg && (
              <>
                  <BusinessUnitManager orgId={selectedOrg} selectedId={selectedBU} onSelect={handleSelectBusinessUnit} />
                  {selectedBU && <SalesOfficeManager orgId={selectedOrg} businessUnitId={selectedBU} selectedId={selectedSO} onSelect={handleSelectSalesOffice} />}
                  {selectedSO && <PlantManager orgId={selectedOrg} businessUnitId={selectedBU} salesOfficeId={selectedSO} selectedId={selectedPlant} onSelect={handleSelectPlant} />}
                  {selectedPlant && <LocationManager orgId={selectedOrg} businessUnitId={selectedBU} salesOfficeId={selectedSO} plantId={selectedPlant} selectedId={selectedLocation} onSelect={setSelectedLocation} />}
              </>
            )}
          </div>
            {selectedOrg && selectedBU && (
              <VehicleManager
                orgId={selectedOrg}
                businessUnitId={selectedBU}
                salesOfficeId={selectedSO || undefined}
                plantId={selectedPlant || undefined}
                locationId={selectedLocation || undefined}
              />
            )}
          {!selectedOrg && (
            <Card className="p-8 text-center border-dashed bg-muted/20">
              <p className="text-gray-700 font-medium">Select an organization in the Structure tab to start hierarchy management.</p>
              <p className="text-sm text-muted-foreground mt-1">Business Units, Sales Offices, Plants, and Locations become available after organization selection.</p>
            </Card>
          )}
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          {selectedOrg && <RoleManager orgId={selectedOrg} />}
          {selectedOrg && (
            <RoleAssignmentManager
              orgId={selectedOrg}
              orgName={selectionNames.org}
              businessUnitId={selectedBU || undefined}
              businessUnitName={selectionNames.businessUnit}
              salesOfficeId={selectedSO || undefined}
              salesOfficeName={selectionNames.salesOffice}
              plantId={selectedPlant || undefined}
              plantName={selectionNames.plant}
              locationId={selectedLocation || undefined}
              locationName={selectionNames.location}
            />
          )}
          {!selectedOrg && (
            <Card className="p-8 text-center border-dashed bg-muted/20">
              <p className="text-gray-700 font-medium">Select an organization in the Structure tab to manage roles.</p>
            </Card>
          )}
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          {selectedOrg && <AuditLogViewer orgId={selectedOrg} />}
          {!selectedOrg && (
            <Card className="p-8 text-center border-dashed bg-muted/20">
              <p className="text-gray-700 font-medium">Select an organization in the Structure tab to view audit logs.</p>
            </Card>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          {selectedOrg && <WebhookManager orgId={selectedOrg} />}
          {!selectedOrg && (
            <Card className="p-8 text-center border-dashed bg-muted/20">
              <p className="text-gray-700 font-medium">Select an organization in the Structure tab to manage webhooks.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Reference Card */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Quick Reference</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-md border bg-white p-3"><strong>Organizations:</strong> Top-level legal entity container.</div>
          <div className="rounded-md border bg-white p-3"><strong>Business Units:</strong> Brand dealer or marketplace layer.</div>
          <div className="rounded-md border bg-white p-3"><strong>Sales Offices:</strong> Regional operating centers.</div>
          <div className="rounded-md border bg-white p-3"><strong>Plants:</strong> Showrooms, workshops, stockyards, branches.</div>
          <div className="rounded-md border bg-white p-3"><strong>Locations:</strong> Operational zones under a plant.</div>
          <div className="rounded-md border bg-white p-3"><strong>Vehicles:</strong> Inventory scoped by selected hierarchy context.</div>
          <div className="rounded-md border bg-white p-3"><strong>Roles:</strong> Permission-based access by hierarchy level.</div>
          <div className="rounded-md border bg-white p-3"><strong>Audit Trail:</strong> Full change trace with attribution.</div>
          <div className="rounded-md border bg-white p-3"><strong>Webhooks:</strong> Event delivery to external systems.</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HierarchyDashboard;
