import { useState, useEffect } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { apiDbQuery } from '@/lib/apiClient';
import { createBrand, updateBrand as updateBrandRecord } from '@/lib/locationBrandService';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { ENTITY_ORCHESTRATION, ENTITY_ORCHESTRATION_LABEL } from '@/constants/entityOrchestration';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';

interface BrandForm {
  id: string;
  name: string;
  dealer_id: string;
  logo_url: string;
  description: string;
  meta_title: string;
  meta_description: string;
}

const BrandSettings = () => {
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SUPERADMIN;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<BrandForm[]>([]);
  const [dealers, setDealers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('all');
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmBrandId, setDeleteConfirmBrandId] = useState<string | null>(null);

  useEffect(() => {
    if (dealerLoading) return;

    const fetch = async () => {
      setLoading(true);
      if (isSuperAdmin) {
        const dealerRows = await apiDbQuery<any[]>({
          table: 'dealers',
          action: 'select',
          select: 'id, name',
          order: [{ field: 'name', ascending: true }],
        });
        setDealers((dealerRows || []).map((d) => ({ id: d.id, name: d.name })));
      }

      const filters = !isSuperAdmin
        ? (dealerId ? [{ field: 'dealer_id', op: 'eq' as const, value: dealerId }] : undefined)
        : (selectedDealerId !== 'all' ? [{ field: 'dealer_id', op: 'eq' as const, value: selectedDealerId }] : undefined);

      const data = await apiDbQuery<any[]>({
        table: 'brands',
        action: 'select',
        select: 'id, dealer_id, name, logo_url, description, meta_title, meta_description',
        filters,
        order: [{ field: 'name', ascending: true }],
      });

      if (data) {
        setBrands(data.map(b => ({
          id: b.id,
          dealer_id: b.dealer_id,
          name: b.name,
          logo_url: b.logo_url || '',
          description: (b as any).description || '',
          meta_title: (b as any).meta_title || '',
          meta_description: (b as any).meta_description || '',
        })));
        if (data.length > 0) setExpandedBrand(data[0].id);
      }
      setLoading(false);
    };

    if (!dealerId) {
      setLoading(false);
      return;
    }

    void fetch();
  }, [dealerId, dealerLoading, isSuperAdmin, selectedDealerId]);

  const updateBrandField = (id: string, field: keyof BrandForm, value: string) => {
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
    updateBrandField(brandId, 'logo_url', publicUrl);
    setUploadingId(null);
    toast({ title: 'Brand logo uploaded' });
  };

  const handleSaveBrand = async (brand: BrandForm) => {
    setSavingId(brand.id);

    await updateBrandRecord(brand.id, {
        name: brand.name.trim(),
        logo_url: brand.logo_url || null,
        description: brand.description.trim() || null,
        meta_title: brand.meta_title.trim() || null,
        meta_description: brand.meta_description.trim() || null,
    });

    toast({ title: `${brand.name} updated` });
    setSavingId(null);
  };

  const handleAddBrand = async () => {
    const targetDealerId = (selectedDealerId !== 'all' ? selectedDealerId : '') || (dealerId || '');
    if (!targetDealerId || !newBrandName.trim()) return;

    setAddingBrand(true);
    const data = await createBrand({ name: newBrandName.trim(), dealer_id: targetDealerId });
    if (!data) {
      toast({ title: 'Failed to add brand', description: 'Error creating brand', variant: 'destructive' });
      setAddingBrand(false);
      return;
    }
    setBrands(prev => [...prev, {
      id: data.id,
      dealer_id: (data as any).dealer_id || targetDealerId,
      name: data.name,
      logo_url: data.logo_url || '',
      description: (data as any).description || '',
      meta_title: (data as any).meta_title || '',
      meta_description: (data as any).meta_description || '',
    }]);
    setExpandedBrand(data.id);
    setNewBrandName('');
    setAddingBrand(false);
    toast({ title: 'Brand added' });
  };

  const handleDeleteBrand = async (brandId: string) => {
    setDeletingId(brandId);
    try {
      await deleteBrand(brandId);
      setBrands(prev => prev.filter(b => b.id !== brandId));
      setDeleteConfirmBrandId(null);
      toast({ title: 'Brand deleted successfully' });
    } catch (error: any) {
      toast({ 
        title: 'Failed to delete brand', 
        description: error?.message || 'Error deleting brand', 
        variant: 'destructive' 
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8">Loading...</div>;
  }

  if (!dealerId) {
    return (
      <Card className="shadow-elevated">
        <CardContent className="py-12 text-center text-muted-foreground">
          Create your {ENTITY_ORCHESTRATION.dealer.toLowerCase()} first in the {ENTITY_ORCHESTRATION.dealer} Profile tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Orchestration: {ENTITY_ORCHESTRATION_LABEL}</p>
      <Card className="shadow-elevated">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          {isSuperAdmin && (
            <div className="sm:w-72 space-y-2">
              <Label>Filter by {ENTITY_ORCHESTRATION.dealer}</Label>
              <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
                <SelectTrigger>
                  <SelectValue placeholder={`All ${ENTITY_ORCHESTRATION.brands}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {ENTITY_ORCHESTRATION.brands}</SelectItem>
                  {dealers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Label>Add {ENTITY_ORCHESTRATION.brands}</Label>
            <Input
              value={newBrandName}
              onChange={e => setNewBrandName(e.target.value)}
              placeholder="e.g. Toyota, Honda, BMW"
              onKeyDown={e => { if (e.key === 'Enter') void handleAddBrand(); }}
            />
          </div>
          <Button
            onClick={handleAddBrand}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {addingBrand ? 'Adding…' : `Add ${ENTITY_ORCHESTRATION.dealer} ${ENTITY_ORCHESTRATION.brands}`}
          </Button>
        </CardContent>
      </Card>

      {brands.length === 0 && (
        <Card className="shadow-elevated">
          <CardContent className="py-10 text-center text-muted-foreground">
            No {ENTITY_ORCHESTRATION.brands.toLowerCase()} yet. Add your first one above.
          </CardContent>
        </Card>
      )}

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
                    {isSuperAdmin && brand.dealer_id && (
                      <> • {dealers.find((d) => d.id === brand.dealer_id)?.name || brand.dealer_id}</>
                    )}
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
                          onClick={() => updateBrandField(brand.id, 'logo_url', '')}
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
                    <Input value={brand.name} onChange={e => updateBrandField(brand.id, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Title (Meta)</Label>
                    <Input
                      value={brand.meta_title}
                      onChange={e => updateBrandField(brand.id, 'meta_title', e.target.value)}
                      placeholder="e.g. Toyota Test Drives — Book Now"
                      maxLength={60}
                    />
                    <p className="text-xs text-muted-foreground">{brand.meta_title.length}/60 characters</p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Brand Description</Label>
                  <Textarea
                    value={brand.description}
                    onChange={e => updateBrandField(brand.id, 'description', e.target.value)}
                    placeholder="A brief description of this brand for your showroom..."
                    rows={3}
                  />
                </div>

                {/* Meta Description */}
                <div className="space-y-2">
                  <Label>Meta Description (SEO)</Label>
                  <Textarea
                    value={brand.meta_description}
                    onChange={e => updateBrandField(brand.id, 'meta_description', e.target.value)}
                    placeholder="A 160 character description for search engines..."
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">{brand.meta_description.length}/160 characters</p>
                </div>

                {/* Save */}
                <div className="flex justify-end">
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
