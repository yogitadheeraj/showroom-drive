import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { listBusinessUnits, listSalesOffices, listPlants, type BusinessUnit, type SalesOffice, type Plant } from '@/lib/hierarchyService';
import {
  listBrandsWithLocations,
  updateBrandBusinessUnit,
  linkBrandLocation,
  unlinkBrandLocation,
  type BrandWithLocations,
} from '@/lib/brandLocationService';
import { createBrand, updateBrand as saveBrand } from '@/lib/locationBrandService';
import { apiDbQuery } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import {
  Tag,
  Plus,
  Building2,
  MapPin,
  Pencil,
  Link2,
  Unlink,
  Loader2,
  AlertCircle,
  PackageOpen,
} from 'lucide-react';

type Location = { id: string; name: string; city: string | null; businessUnitId?: string | null };

const BrandsPage = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { dealerId, dealerLocations, loading: dealerLoading } = useDealerContext();
  const { role } = useAuth();

  const isAdmin =
    role === APP_ROLE.SUPERADMIN ||
    role === APP_ROLE.DEALER_ADMIN ||
    role === APP_ROLE.BRAND_ADMIN;

  // ── state ──────────────────────────────────────────────────────────────────
  const [brands, setBrands] = useState<BrandWithLocations[]>([]);
  const [highlightBrandId, setHighlightBrandId] = useState<string | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [allSalesOffices, setAllSalesOffices] = useState<SalesOffice[]>([]);
  const [allPlants, setAllPlants] = useState<Plant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Add brand dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', code: '', businessUnitId: '', salesOfficeId: '', plantId: '' });
  const [addSaving, setAddSaving] = useState(false);

  // Derived dropdowns for add dialog
  const addDialogSalesOffices = allSalesOffices.filter(so => so.businessUnitId === addForm.businessUnitId);
  const addDialogPlants = allPlants.filter(p => p.salesOfficeId === addForm.salesOfficeId);

  // Edit BU dialog
  const [editBrand, setEditBrand] = useState<BrandWithLocations | null>(null);
  const [editBuId, setEditBuId] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  // Link location dialog
  const [linkBrand, setLinkBrand] = useState<BrandWithLocations | null>(null);
  const [linkLocationId, setLinkLocationId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  // ── fetch data ─────────────────────────────────────────────────────────────
  const brandQueryId = searchParams.get('brandId');
  const load = async () => {
    if (!dealerId) return;
    setLoading(true);
    if (brandQueryId) setHighlightBrandId(brandQueryId);
    try {
      const [brandsData, busData, soData, plantData] = await Promise.all([
        listBrandsWithLocations({ dealer_id: dealerId }),
        listBusinessUnits(dealerId),
        listSalesOffices({ orgId: dealerId }),
        listPlants({ orgId: dealerId }),
      ]);
      setBrands(brandsData);
      setBusinessUnits(busData);
      setAllSalesOffices(soData ?? []);
      setAllPlants(plantData ?? []);

      // Fetch all locations for this dealer
      const locData = await apiDbQuery<any[]>({
        table: 'locations',
        action: 'select',
        select: 'id, name, city',
        filters: [{ field: 'dealer_id', op: 'eq', value: dealerId }],
        order: [{ field: 'name', ascending: true }],
      });
      setLocations((locData ?? []).map((l: any) => ({ id: l.id, name: l.name, city: l.city })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dealerLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId, dealerLoading]);

  // ── add brand ──────────────────────────────────────────────────────────────
  const handleAddBrand = async () => {
    if (!dealerId || !addForm.name.trim()) return;
    setAddSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: addForm.name.trim(),
        dealer_id: dealerId,
      };
      if (addForm.code.trim()) payload.code = addForm.code.trim().toUpperCase();
      if (addForm.businessUnitId) payload.businessUnitId = addForm.businessUnitId;
      if (addForm.salesOfficeId) payload.salesOfficeId = addForm.salesOfficeId;
      if (addForm.plantId) payload.plantId = addForm.plantId;

      await createBrand(payload);
      toast({ title: 'Brand added' });
      setShowAddDialog(false);
      setAddForm({ name: '', code: '', businessUnitId: '', salesOfficeId: '', plantId: '' });
      void load();
    } catch (err: any) {
      toast({ title: 'Failed to add brand', description: err?.message, variant: 'destructive' });
    } finally {
      setAddSaving(false);
    }
  };

  // ── update business unit ───────────────────────────────────────────────────
  const handleSaveEditBu = async () => {
    if (!editBrand) return;
    setEditSaving(true);
    try {
      await updateBrandBusinessUnit(editBrand.id, editBuId || null);
      toast({ title: 'Business unit updated' });
      setEditBrand(null);
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  // ── link location ─────────────────────────────────────────────────────────
  const handleLinkLocation = async () => {
    if (!linkBrand || !linkLocationId || !linkBrand.orgId) return;
    setLinkSaving(true);
    try {
      await linkBrandLocation({
        orgId: linkBrand.orgId,
        brandId: linkBrand.id,
        locationId: linkLocationId,
        businessUnitId: linkBrand.businessUnitId,
      });
      toast({ title: 'Location linked to brand' });
      setLinkBrand(null);
      setLinkLocationId('');
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    } finally {
      setLinkSaving(false);
    }
  };

  const handleUnlink = async (brand: BrandWithLocations, locationId: string) => {
    if (!brand.orgId) return;
    try {
      await unlinkBrandLocation(brand.id, locationId, brand.orgId);
      toast({ title: 'Location unlinked' });
      void load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    }
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const getBuName = (id: string | null) =>
    businessUnits.find(bu => bu.id === id)?.name ?? null;

  const getLocName = (id: string) => {
    const l = locations.find(loc => loc.id === id);
    return l ? `${l.name}${l.city ? ` — ${l.city}` : ''}` : id;
  };

  // Locations not yet linked to this brand
  const availableLocations = (brand: BrandWithLocations) =>
    locations.filter(l => !brand.locationIds.includes(l.id));

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center">
              <Tag className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
              <p className="text-sm text-muted-foreground">
                Manage brands, their business units, and location assignments
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Brand
            </Button>
          )}
        </div>

        {/* Brand cards */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <PackageOpen className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">No brands yet</p>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Add your first brand
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map(brand => {
              const buName = getBuName(brand.businessUnitId);
              return (
                <Card
                  key={brand.id}
                  className={cn(
                    'group relative overflow-hidden',
                    brand.id === highlightBrandId ? 'border-primary/60 ring-2 ring-primary/10' : ''
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="w-10 h-10 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center shrink-0">
                            <Tag className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{brand.name}</CardTitle>
                          {brand.code && (
                            <p className="text-xs text-muted-foreground font-mono">{brand.code}</p>
                          )}
                        </div>
                      </div>
                      {!brand.is_active && (
                        <Badge variant="outline" className="text-xs shrink-0">Inactive</Badge>
                      )}
                    </div>

                    {/* Business Unit row */}
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      {buName ? (
                        <span className="text-xs text-muted-foreground truncate">{buName}</span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">No business unit</span>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setEditBrand(brand);
                            setEditBuId(brand.businessUnitId ?? '');
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* Linked locations */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Locations ({brand?.locationIds?.length})
                        </p>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setLinkBrand(brand);
                              setLinkLocationId('');
                            }}
                          >
                            <Link2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {brand?.locationIds?.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No locations linked</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {brand?.locationIds?.map(locId => (
                            <Badge
                              key={locId}
                              variant="secondary"
                              className={cn(
                                'text-xs gap-1',
                                isAdmin && 'pr-1 group/badge cursor-default',
                              )}
                            >
                              {getLocName(locId)}
                              {isAdmin && (
                                <button
                                  className="opacity-50 hover:opacity-100 transition-opacity"
                                  onClick={() => handleUnlink(brand, locId)}
                                  title="Unlink location"
                                >
                                  <Unlink className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Brand Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Brand</DialogTitle>
            <DialogDescription>Create a new brand and assign it to a business unit, sales office, and plant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Brand Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Maruti Suzuki"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. MARUTI"
                value={addForm.code}
                onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                className="uppercase"
              />
            </div>
            {businessUnits.length > 0 && (
              <div className="space-y-1.5">
                <Label>Business Unit <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={addForm.businessUnitId}
                  onValueChange={v => setAddForm(f => ({ ...f, businessUnitId: v, salesOfficeId: '', plantId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map(bu => (
                      <SelectItem key={bu.id} value={bu.id}>{bu.name} ({bu.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {addForm.businessUnitId && addDialogSalesOffices.length > 0 && (
              <div className="space-y-1.5">
                <Label>Sales Office <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={addForm.salesOfficeId}
                  onValueChange={v => setAddForm(f => ({ ...f, salesOfficeId: v, plantId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sales office" />
                  </SelectTrigger>
                  <SelectContent>
                    {addDialogSalesOffices.map(so => (
                      <SelectItem key={so.id} value={so.id}>{so.name} ({so.salesOfficeCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {addForm.salesOfficeId && addDialogPlants.length > 0 && (
              <div className="space-y-1.5">
                <Label>Plant <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={addForm.plantId}
                  onValueChange={v => setAddForm(f => ({ ...f, plantId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plant" />
                  </SelectTrigger>
                  <SelectContent>
                    {addDialogPlants.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.plantCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddBrand}
              disabled={addSaving || !addForm.name.trim()}
            >
              {addSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Business Unit Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!editBrand} onOpenChange={open => !open && setEditBrand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Business Unit</DialogTitle>
            <DialogDescription>
              Set the business unit for <strong>{editBrand?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Business Unit</Label>
            <Select value={editBuId} onValueChange={setEditBuId}>
              <SelectTrigger>
                <SelectValue placeholder="Select business unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {businessUnits.map(bu => (
                  <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBrand(null)}>Cancel</Button>
            <Button onClick={handleSaveEditBu} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link Location Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!linkBrand} onOpenChange={open => { if (!open) { setLinkBrand(null); setLinkLocationId(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Location</DialogTitle>
            <DialogDescription>
              Link a location to <strong>{linkBrand?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Location <span className="text-destructive">*</span></Label>
            {linkBrand && availableLocations(linkBrand).length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                All locations are already linked to this brand.
              </div>
            ) : (
              <Select value={linkLocationId} onValueChange={setLinkLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {(linkBrand ? availableLocations(linkBrand) : []).map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}{loc.city ? ` — ${loc.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLinkBrand(null); setLinkLocationId(''); }}>Cancel</Button>
            <Button
              onClick={handleLinkLocation}
              disabled={linkSaving || !linkLocationId || (linkBrand ? availableLocations(linkBrand).length === 0 : true)}
            >
              {linkSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Link Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BrandsPage;
