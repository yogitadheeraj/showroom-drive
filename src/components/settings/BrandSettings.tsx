import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDealerContext } from '@/hooks/useDealerContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X, ChevronDown, ChevronUp } from 'lucide-react';

interface BrandForm {
  id: string;
  name: string;
  logo_url: string;
  description: string;
  meta_title: string;
  meta_description: string;
}

const BrandSettings = () => {
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<BrandForm[]>([]);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    if (dealerLoading) return;
    if (!dealerId) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, logo_url, description, meta_title, meta_description')
        .eq('dealer_id', dealerId)
        .order('name');
      if (error) {
        toast({ title: 'Failed to load brands', description: error.message, variant: 'destructive' });
      }
      if (data) {
        setBrands(data.map(b => ({
          id: b.id,
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
    void fetch();
  }, [dealerId, dealerLoading, toast]);

  const updateBrand = (id: string, field: keyof BrandForm, value: string) => {
    setBrands(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleLogoUpload = async (brandId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(brandId);
    const ext = file.name.split('.').pop();
    const path = `brands/${brandId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    updateBrand(brandId, 'logo_url', urlData.publicUrl);
    setUploadingId(null);
    toast({ title: 'Brand logo uploaded' });
  };

  const handleSaveBrand = async (brand: BrandForm) => {
    setSavingId(brand.id);

    const { error } = await supabase.from('brands').update({
      name: brand.name.trim(),
      logo_url: brand.logo_url || null,
      description: brand.description.trim() || null,
      meta_title: brand.meta_title.trim() || null,
      meta_description: brand.meta_description.trim() || null,
    } as any).eq('id', brand.id);

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${brand.name} updated` });
    }
    setSavingId(null);
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8">Loading...</div>;
  }

  if (brands.length === 0) {
    return (
      <Card className="shadow-elevated">
        <CardContent className="py-12 text-center text-muted-foreground">
          No brands found. Add brands from the onboarding flow first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
