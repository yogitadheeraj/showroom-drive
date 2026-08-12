import { useState, useEffect, useCallback } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Trash2, Building2, Briefcase, Factory, ChevronRight,
  ChevronDown, Loader2, MapPin, Tag,
} from 'lucide-react';
import {
  listBusinessUnits, createBusinessUnit, deleteBusinessUnit,
  listSalesOffices, createSalesOffice, deleteSalesOffice,
  listPlants, createPlant, deletePlant,
  type BusinessUnit, type SalesOffice, type Plant,
} from '@/lib/hierarchyService';
import { apiDbQuery } from '@/lib/apiClient';

type DialogMode =
  | { type: 'add-bu' }
  | { type: 'add-so'; buId: string }
  | { type: 'add-plant'; buId: string; soId: string }
  | null;

const HierarchySettings = ({ dealerIdOverride }: { dealerIdOverride?: string } = {}) => {
  const { dealerId: ctxDealerId, loading: dealerLoading } = useDealerContext();
  const dealerId = dealerIdOverride || ctxDealerId;
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const { toast } = useToast();

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [salesOffices, setSalesOffices] = useState<SalesOffice[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [brandCount, setBrandCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedBUs, setExpandedBUs] = useState<Set<string>>(new Set());
  const [expandedSOs, setExpandedSOs] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!dealerId && !isSuperAdmin) return;
    setLoading(true);
    const dealerFilter = dealerId ? [{ field: 'dealer_id', op: 'eq' as const, value: dealerId }] : undefined;
    const [buData, soData, plantData, brandRows, locationRows] = await Promise.all([
      listBusinessUnits(dealerId || undefined),
      listSalesOffices({ orgId: dealerId || undefined }),
      listPlants({ orgId: dealerId || undefined }),
      apiDbQuery<any[]>({
        table: 'brands',
        action: 'select',
        select: 'id',
        filters: dealerFilter,
      }).catch(() => []),
      apiDbQuery<any[]>({
        table: 'locations',
        action: 'select',
        select: 'id',
        filters: dealerFilter,
      }).catch(() => []),
    ]);
    const bus = buData ?? [];
    setBusinessUnits(bus);
    setSalesOffices(soData ?? []);
    setPlants(plantData ?? []);
    setBrandCount((brandRows ?? []).length);
    setLocationCount((locationRows ?? []).length);
    // Auto-expand all BUs and SOs so tree is visible
    setExpandedBUs(new Set(bus.map(b => b.id)));
    setExpandedSOs(new Set((soData ?? []).map(s => s.id)));
    setLoading(false);
  }, [dealerId]);

  useEffect(() => { if (!dealerLoading) void load(); }, [load, dealerLoading]);

  const toggleBU = (id: string) => {
    setExpandedBUs(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSO = (id: string) => {
    setExpandedSOs(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const openDialog = (mode: DialogMode) => {
    setForm({});
    setDialog(mode);
  };

  const handleSave = async () => {
    if (!dealerId || !dialog) return;
    setSaving(true);
    try {
      if (dialog.type === 'add-bu') {
        if (!form.name?.trim() || !form.code?.trim()) return;
        await createBusinessUnit({ orgId: dealerId, name: form.name.trim(), code: form.code.trim().toUpperCase() });
        toast({ title: 'Business Unit created' });
      } else if (dialog.type === 'add-so') {
        if (!form.name?.trim() || !form.salesOfficeCode?.trim()) return;
        await createSalesOffice({
          orgId: dealerId,
          businessUnitId: dialog.buId,
          name: form.name.trim(),
          salesOfficeCode: form.salesOfficeCode.trim().toUpperCase(),
          externalSalesOfficeId: form.externalId?.trim() || null,
        });
        toast({ title: 'Sales Office created' });
      } else if (dialog.type === 'add-plant') {
        if (!form.name?.trim() || !form.plantCode?.trim()) return;
        await createPlant({
          orgId: dealerId,
          businessUnitId: dialog.buId,
          salesOfficeId: dialog.soId,
          name: form.name.trim(),
          plantCode: form.plantCode.trim().toUpperCase(),
          externalPlantId: form.externalId?.trim() || null,
        });
        toast({ title: 'Plant created' });
      }
      setDialog(null);
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBU = async (id: string, name: string) => {
    if (!window.confirm(`Delete Business Unit "${name}"? All linked Sales Offices and Plants may be affected.`)) return;
    try {
      await deleteBusinessUnit(id);
      toast({ title: 'Business Unit deleted' });
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteSO = async (id: string, name: string) => {
    if (!window.confirm(`Delete Sales Office "${name}"?`)) return;
    try {
      await deleteSalesOffice(id);
      toast({ title: 'Sales Office deleted' });
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeletePlant = async (id: string, name: string) => {
    if (!window.confirm(`Delete Plant "${name}"?`)) return;
    try {
      await deletePlant(id);
      toast({ title: 'Plant deleted' });
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const isSaveDisabled = () => {
    if (!dialog) return true;
    if (dialog.type === 'add-bu') return !form.name?.trim() || !form.code?.trim();
    if (dialog.type === 'add-so') return !form.name?.trim() || !form.salesOfficeCode?.trim();
    if (dialog.type === 'add-plant') return !form.name?.trim() || !form.plantCode?.trim();
    return true;
  };

  if (dealerLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!dealerId && !isSuperAdmin) return <p className="text-sm text-muted-foreground">No entity context found.</p>;

  return (
    <>
      <Card className="border-border/70">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </span>
              <div>
                <CardTitle className="text-lg font-heading">Entity Hierarchy</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-0.5">
                  Business Units <ChevronRight className="h-3 w-3" /> Sales Offices <ChevronRight className="h-3 w-3" /> Plants
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => openDialog({ type: 'add-bu' })} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Add Business Unit
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:w-[360px]">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> Brands
              </div>
              <p className="mt-1 text-lg font-semibold text-foreground">{brandCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Locations
              </div>
              <p className="mt-1 text-lg font-semibold text-foreground">{locationCount}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : businessUnits.length === 0 ? (
            <div className="text-center py-14 border border-dashed rounded-xl space-y-3">
              <Building2 className="h-9 w-9 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No Business Units yet.</p>
              <Button size="sm" variant="outline" onClick={() => openDialog({ type: 'add-bu' })} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create your first Business Unit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {businessUnits.map(bu => {
                const buSOs = salesOffices.filter(so => so.businessUnitId === bu.id);
                const buExpanded = expandedBUs.has(bu.id);
                return (
                  <div key={bu.id} className="border border-border rounded-xl overflow-hidden">
                    {/* BU Row */}
                    <div className="flex items-center justify-between px-4 py-3 bg-violet-50/60 dark:bg-violet-950/20 group">
                      <button
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        onClick={() => toggleBU(bu.id)}
                      >
                        <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
                          <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{bu.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">Code: {bu.code} · {buSOs.length} office{buSOs.length !== 1 ? 's' : ''}</p>
                        </div>
                        {buExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />}
                      </button>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <Badge variant={bu.isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5">{bu.isActive ? 'Active' : 'Inactive'}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400"
                          onClick={() => openDialog({ type: 'add-so', buId: bu.id })}
                        >
                          <Plus className="h-3 w-3" /> Sales Office
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteBU(bu.id, bu.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Sales Offices */}
                    {buExpanded && (
                      <div className="border-t border-border/50">
                        {buSOs.length === 0 ? (
                          <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            No Sales Offices yet.
                            <button
                              className="text-emerald-600 hover:underline font-medium"
                              onClick={() => openDialog({ type: 'add-so', buId: bu.id })}
                            >
                              Add one
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/40">
                            {buSOs.map(so => {
                              const soPlants = plants.filter(p => p.salesOfficeId === so.id);
                              const soExpanded = expandedSOs.has(so.id);
                              return (
                                <div key={so.id}>
                                  {/* SO Row */}
                                  <div className="flex items-center justify-between px-5 py-2.5 bg-emerald-50/40 dark:bg-emerald-950/10 group">
                                    <button
                                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                                      onClick={() => toggleSO(so.id)}
                                    >
                                      <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                                        <Briefcase className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{so.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{so.salesOfficeCode} · {soPlants.length} plant{soPlants.length !== 1 ? 's' : ''}</p>
                                      </div>
                                      {soExpanded
                                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
                                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />}
                                    </button>
                                    <div className="flex items-center gap-2 ml-2 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[11px] gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400"
                                        onClick={() => openDialog({ type: 'add-plant', buId: bu.id, soId: so.id })}
                                      >
                                        <Plus className="h-3 w-3" /> Plant
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteSO(so.id, so.name)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Plants */}
                                  {soExpanded && (
                                    <div className="border-t border-border/30">
                                      {soPlants.length === 0 ? (
                                        <div className="flex items-center gap-2 px-8 py-2.5 text-xs text-muted-foreground">
                                          <Factory className="h-3.5 w-3.5 shrink-0" />
                                          No plants yet.
                                          <button
                                            className="text-orange-600 hover:underline font-medium"
                                            onClick={() => openDialog({ type: 'add-plant', buId: bu.id, soId: so.id })}
                                          >
                                            Add one
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="divide-y divide-border/30">
                                          {soPlants.map(plant => (
                                            <div key={plant.id} className="flex items-center justify-between px-8 py-2.5 group hover:bg-muted/30 transition-colors">
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-orange-100 dark:bg-orange-950/30 shrink-0">
                                                  <Factory className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                                </span>
                                                <div className="min-w-0">
                                                  <p className="text-xs font-medium text-foreground truncate">{plant.name}</p>
                                                  <p className="text-[11px] text-muted-foreground font-mono">{plant.plantCode}</p>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <Badge variant={plant.isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5">{plant.isActive ? 'Active' : 'Inactive'}</Badge>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-6 w-6 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  onClick={() => handleDeletePlant(plant.id, plant.name)}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Unified Add Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!dialog} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === 'add-bu' && 'Add Business Unit'}
              {dialog?.type === 'add-so' && 'Add Sales Office'}
              {dialog?.type === 'add-plant' && 'Add Plant'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Context breadcrumb for SO / Plant */}
            {dialog && dialog.type !== 'add-bu' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Building2 className="h-3.5 w-3.5 text-violet-500" />
                <span>{businessUnits.find(b => b.id === dialog.buId)?.name}</span>
                {dialog.type === 'add-plant' && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <Briefcase className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{salesOffices.find(s => s.id === dialog.soId)?.name}</span>
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name ?? ''}
                placeholder={
                  dialog?.type === 'add-bu' ? 'e.g. Passenger Vehicles' :
                  dialog?.type === 'add-so' ? 'e.g. Dubai Main Office' :
                  'e.g. Dubai Vehicle Plant'
                }
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            {dialog?.type === 'add-bu' && (
              <div className="space-y-1.5">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input
                  value={form.code ?? ''}
                  placeholder="e.g. PV"
                  className="uppercase"
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                />
              </div>
            )}

            {dialog?.type === 'add-so' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Office Code <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.salesOfficeCode ?? ''}
                    placeholder="DXB_SO"
                    className="uppercase"
                    onChange={e => setForm(p => ({ ...p, salesOfficeCode: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>External ID</Label>
                  <Input
                    value={form.externalId ?? ''}
                    placeholder="SAP_SO_001"
                    onChange={e => setForm(p => ({ ...p, externalId: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {dialog?.type === 'add-plant' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Plant Code <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.plantCode ?? ''}
                    placeholder="DXB_PLANT_01"
                    className="uppercase"
                    onChange={e => setForm(p => ({ ...p, plantCode: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>External ID</Label>
                  <Input
                    value={form.externalId ?? ''}
                    placeholder="SAP_PLANT_001"
                    onChange={e => setForm(p => ({ ...p, externalId: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || isSaveDisabled()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? 'Saving...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HierarchySettings;
