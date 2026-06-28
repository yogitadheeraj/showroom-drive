import { useState, useEffect } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery } from '@/lib/apiClient';
import { buildBrandPayload, createBrand, deleteBrand as deleteBrandApi, updateBrand as updateBrandApi } from '@/lib/locationBrandService';
import { listBusinessUnits, listSalesOffices, listPlants, type BusinessUnit, type SalesOffice, type Plant } from '@/lib/hierarchyService';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X, ChevronDown, ChevronUp, Plus } from 'lucide-react';

interface BrandForm {
  id: string;
  name: string;
  logo_url: string;
  description: string;
  meta_title: string;
  meta_description: string;
  businessUnitId?: string;
  salesOfficeId?: string;
  plantId?: string;
}

const BrandSettings = ({ dealerIdOverride }: { dealerIdOverride?: string } = {}) => {
  const { dealerId: ctxDealerId, loading: dealerLoading } = useDealerContext();
  const dealerId = dealerIdOverride || ctxDealerId;
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<BrandForm[]>([]);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);

  // ── New Brand Dialog state ──────────────────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ brandName: '', buId: '', buName: '', soId: '', soName: '', plantId: '', plantName: '' });
  const [addFormBUs, setAddFormBUs] = useState<BusinessUnit[]>([]);
  const [addFormSOs, setAddFormSOs] = useState<SalesOffice[]>([]);
  const [addFormPlants, setAddFormPlants] = useState<Plant[]>([]);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandForm | null>(null);
  const [hierarchyOptions, setHierarchyOptions] = useState<{ bus: BusinessUnit[]; sos: SalesOffice[]; plants: Plant[] }>({ bus: [], sos: [], plants: [] });

  useEffect(() => {
    if (dealerLoading) return;
    if (!dealerId && !isSuperAdmin) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const data = await apiDbQuery<any[]>({
        table: 'brands',
        action: 'select',
        select: 'id, name, logo_url, description, meta_title, meta_description, businessUnitId, salesOfficeId, plantId',
        filters: dealerId ? [{ field: 'dealer_id', op: 'eq', value: dealerId }] : undefined,
        order: [{ field: 'name', ascending: true }],
      });
      if (data) {
        setBrands(data.map(b => ({
          id: b.id,
          name: b.name,
          logo_url: b.logo_url || '',
          description: (b as any).description || '',
          meta_title: (b as any).meta_title || '',
          meta_description: (b as any).meta_description || '',
          businessUnitId: (b as any).businessUnitId || '',
          salesOfficeId: (b as any).salesOfficeId || '',
          plantId: (b as any).plantId || '',
        })));
        if (data.length > 0) setExpandedBrand(data[0].id);
      }
      setLoading(false);
    };
    void fetch();
  }, [dealerId, dealerLoading, toast]);

  // Load hierarchy options for both create and edit flows
  useEffect(() => {
    if (!dealerId && !isSuperAdmin) return;
    Promise.all([
      listBusinessUnits(dealerId || undefined),
      listSalesOffices(dealerId ? { orgId: dealerId } : {}),
      listPlants(dealerId ? { orgId: dealerId } : {}),
    ]).then(([bus, sos, pls]) => {
      const normalizedBus = bus ?? [];
      const normalizedSos = sos ?? [];
      const normalizedPlants = pls ?? [];
      setAddFormBUs(normalizedBus);
      setAddFormSOs(normalizedSos);
      setAddFormPlants(normalizedPlants);
      setHierarchyOptions({ bus: normalizedBus, sos: normalizedSos, plants: normalizedPlants });
    });
  }, [dealerId, isSuperAdmin]);

  // Auto-select BU when only one exists
  useEffect(() => {
    if (!showAddDialog || addFormBUs.length !== 1 || addForm.buId) return;
    const bu = addFormBUs[0];
    setAddForm(p => ({ ...p, buId: bu.id, buName: bu.name }));
  }, [showAddDialog, addFormBUs]);

  // Auto-select SO when only one exists for selected BU
  useEffect(() => {
    if (!showAddDialog || !addForm.buId) return;
    const list = addFormSOs.filter(s => s.businessUnitId === addForm.buId);
    if (list.length === 1 && !addForm.soId) setAddForm(p => ({ ...p, soId: list[0].id, soName: list[0].name }));
  }, [showAddDialog, addForm.buId, addFormSOs]);

  // Auto-select Plant when only one exists for selected SO
  useEffect(() => {
    if (!showAddDialog || !addForm.soId) return;
    const list = addFormPlants.filter(pl => pl.salesOfficeId === addForm.soId);
    if (list.length === 1 && !addForm.plantId) setAddForm(p => ({ ...p, plantId: list[0].id, plantName: list[0].name }));
  }, [showAddDialog, addForm.soId, addFormPlants]);

  const updateBrand = (id: string, field: keyof BrandForm, value: string) => {
    setBrands(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleLogoUpload = async (brandId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(brandId);
    const ext = file.name.split('.').pop();
    const path = `brands/${brandId}/logo.${ext}`;

    try {
      await uploadToStorage('logos', path, file, { upsert: true });
    } catch (uploadError: any) {
      toast({ title: 'Upload failed', description: uploadError?.message || 'Could not upload brand logo', variant: 'destructive' });
      setUploadingId(null);
      return;
    }

    const publicUrl = await getStoragePublicUrl('logos', path);
    updateBrand(brandId, 'logo_url', publicUrl);
    setUploadingId(null);
    toast({ title: 'Brand logo uploaded' });
  };

  const handleSaveBrand = async (brand: BrandForm) => {
    setSavingId(brand.id);
    try {
      const payload = buildBrandPayload({
        name: brand.name,
        dealerId,
        businessUnitId: brand.businessUnitId || undefined,
        salesOfficeId: brand.salesOfficeId || undefined,
        plantId: brand.plantId || undefined,
        description: brand.description,
        logo_url: brand.logo_url,
        meta_title: brand.meta_title,
        meta_description: brand.meta_description,
      });
      await updateBrandApi(brand.id, payload);
      toast({ title: `${brand.name} updated` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateBrand = async () => {
    if (!addForm.brandName.trim()) {
      toast({ title: 'Brand name required', variant: 'destructive' });
      return;
    }
    setCreatingBrand(true);
    try {
      const brandData = await createBrand(buildBrandPayload({
        name: addForm.brandName,
        dealerId,
        orgId: dealerId,
        businessUnitId: addForm.buId || undefined,
        salesOfficeId: addForm.soId || undefined,
        plantId: addForm.plantId || undefined,
        description: null,
        logo_url: null,
        meta_title: null,
        meta_description: null,
      }));
      if (!brandData?.id) throw new Error('Failed to create brand');
      setBrands(prev => [...prev, {
        id: brandData.id,
        name: brandData.name,
        logo_url: (brandData as any).logo_url || '',
        description: (brandData as any).description || '',
        meta_title: (brandData as any).meta_title || '',
        meta_description: (brandData as any).meta_description || '',
        businessUnitId: addForm.buId || '',
        salesOfficeId: addForm.soId || '',
        plantId: addForm.plantId || '',
      }]);
      setExpandedBrand(brandData.id);
      toast({ title: `${addForm.brandName} created` });
      setShowAddDialog(false);
      setAddForm({ brandName: '', buId: '', buName: '', soId: '', soName: '', plantId: '', plantName: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingBrand(false);
    }
  };

  const handleDeleteBrand = async (brand: BrandForm) => {
    try {
      await deleteBrandApi(brand.id);
      setBrands(prev => prev.filter(item => item.id !== brand.id));
      if (expandedBrand === brand.id) setExpandedBrand(null);
      toast({ title: `${brand.name} deleted` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8">Loading...</div>;
  }

  if (!dealerId && !isSuperAdmin) {
    return (
      <Card className="shadow-elevated">
        <CardContent className="py-12 text-center text-muted-foreground">
          Create your dealership first in the Dealership Profile tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Add Brand Button ── */}
      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Brand
        </Button>
      </div>

      {/* ── Add Brand Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={open => { setShowAddDialog(open); if (!open) setAddForm({ brandName: '', buId: '', buName: '', soId: '', soName: '', plantId: '', plantName: '' }); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">New Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Brand Name */}
            <div className="space-y-2">
              <Label>Brand Name *</Label>
              <Input value={addForm.brandName} onChange={e => setAddForm(p => ({ ...p, brandName: e.target.value }))} placeholder="e.g. Toyota, Honda, BMW" />
            </div>

            {/* Hierarchy */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Hierarchy</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Business Unit */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Unit</Label>
                  <Select
                    value={addForm.buId || '__none__'}
                    onValueChange={v => {
                      const val = v === '__none__' ? '' : v;
                      const bu = addFormBUs.find(b => b.id === val);
                      setAddForm(p => ({ ...p, buId: val, buName: bu?.name ?? '', soId: '', soName: '', plantId: '', plantName: '' }));
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select BU" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {addFormBUs.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Sales Office */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Sales Office</Label>
                  <Select
                    value={addForm.soId || '__none__'}
                    onValueChange={v => {
                      const val = v === '__none__' ? '' : v;
                      const so = addFormSOs.find(s => s.id === val);
                      setAddForm(p => ({ ...p, soId: val, soName: so?.name ?? '', plantId: '', plantName: '' }));
                    }}
                    disabled={!addForm.buId}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select SO" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {addFormSOs.filter(s => s.businessUnitId === addForm.buId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Plant */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Plant</Label>
                  <Select
                    value={addForm.plantId || '__none__'}
                    onValueChange={v => {
                      const val = v === '__none__' ? '' : v;
                      const pl = addFormPlants.find(p => p.id === val);
                      setAddForm(p => ({ ...p, plantId: val, plantName: pl?.name ?? '' }));
                    }}
                    disabled={!addForm.soId}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select Plant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {addFormPlants.filter(pl => pl.salesOfficeId === addForm.soId).map(pl => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button onClick={handleCreateBrand} disabled={creatingBrand} className="w-full">
              {creatingBrand ? 'Creating…' : 'Create Brand'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {brands.length === 0 && (
        <Card className="shadow-elevated">
          <CardContent className="py-10 text-center text-muted-foreground">
            No brands yet. Add your first brand above.
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deleteTarget?.name || 'this brand'} from the brand list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDeleteBrand(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {brands.map(brand => {
        const isExpanded = expandedBrand === brand.id;
        return (
          <Card key={brand.id} className="shadow-elevated overflow-hidden">
            <button
              onClick={() => setExpandedBrand(isExpanded ? null : brand.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-10 w-10 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {brand.name[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-heading font-semibold text-foreground">{brand.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {brand.meta_title ? 'Branding configured' : 'No branding yet'}
                  </p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <CardContent className="border-t border-border pt-5 space-y-5">
                {/* Brand Logo */}
                <div className="space-y-3">
                  <Label>Brand Logo</Label>
                  <div className="flex items-center gap-4">
                    {brand.logo_url ? (
                      <div className="relative">
                        <img src={brand.logo_url} alt={brand.name} className="h-16 w-16 rounded-xl object-cover border border-border" />
                        <button
                          onClick={() => updateBrand(brand.id, 'logo_url', '')}
                          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                        <Upload className="h-5 w-5" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleLogoUpload(brand.id, e)} disabled={uploadingId === brand.id} />
                      <Button variant="outline" size="sm" asChild disabled={uploadingId === brand.id}>
                        <span>{uploadingId === brand.id ? 'Uploading...' : 'Upload'}</span>
                      </Button>
                    </label>
                  </div>
                </div>

                {/* Brand Name & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand Name</Label>
                    <Input value={brand.name} onChange={e => updateBrand(brand.id, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Title (Meta)</Label>
                    <Input
                      value={brand.meta_title}
                      onChange={e => updateBrand(brand.id, 'meta_title', e.target.value)}
                      placeholder="e.g. Toyota Test Drives — Book Now"
                      maxLength={60}
                    />
                    <p className="text-xs text-muted-foreground">{brand.meta_title.length}/60 characters</p>
                  </div>
                </div>

                {/* Hierarchy */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Business Unit</Label>
                    <Select
                      value={brand.businessUnitId || '__none__'}
                      onValueChange={v => {
                        const val = v === '__none__' ? '' : v;
                        updateBrand(brand.id, 'businessUnitId' as keyof BrandForm, val);
                        if (val !== brand.businessUnitId) {
                          updateBrand(brand.id, 'salesOfficeId' as keyof BrandForm, '');
                          updateBrand(brand.id, 'plantId' as keyof BrandForm, '');
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select BU" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {hierarchyOptions.bus.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sales Office</Label>
                    <Select
                      value={brand.salesOfficeId || '__none__'}
                      onValueChange={v => {
                        const val = v === '__none__' ? '' : v;
                        updateBrand(brand.id, 'salesOfficeId' as keyof BrandForm, val);
                        if (val !== brand.salesOfficeId) {
                          updateBrand(brand.id, 'plantId' as keyof BrandForm, '');
                        }
                      }}
                      disabled={!brand.businessUnitId}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select SO" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {hierarchyOptions.sos.filter(s => s.businessUnitId === brand.businessUnitId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plant</Label>
                    <Select
                      value={brand.plantId || '__none__'}
                      onValueChange={v => {
                        const val = v === '__none__' ? '' : v;
                        updateBrand(brand.id, 'plantId' as keyof BrandForm, val);
                      }}
                      disabled={!brand.salesOfficeId}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select Plant" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {hierarchyOptions.plants.filter(p => p.salesOfficeId === brand.salesOfficeId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Brand Description</Label>
                  <Textarea
                    value={brand.description}
                    onChange={e => updateBrand(brand.id, 'description', e.target.value)}
                    placeholder="A brief description of this brand for your showroom..."
                    rows={3}
                  />
                </div>

                {/* Meta Description */}
                <div className="space-y-2">
                  <Label>Meta Description (SEO)</Label>
                  <Textarea
                    value={brand.meta_description}
                    onChange={e => updateBrand(brand.id, 'meta_description', e.target.value)}
                    placeholder="A 160 character description for search engines..."
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">{brand.meta_description.length}/160 characters</p>
                </div>

                {/* Save / Delete */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteTarget(brand)}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    onClick={() => handleSaveBrand(brand)}
                    disabled={savingId === brand.id || !brand.name.trim()}
                    className="gradient-primary border-0 text-primary-foreground gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === brand.id ? 'Saving...' : 'Save Brand'}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default BrandSettings;
