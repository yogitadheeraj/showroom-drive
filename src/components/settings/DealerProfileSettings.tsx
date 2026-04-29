import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDealerContext } from '@/hooks/useDealerContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X } from 'lucide-react';

const DealerProfileSettings = () => {
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dealer, setDealer] = useState<any>(null);
  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', logo_url: '' });

  useEffect(() => {
    if (dealerLoading) return;
    if (!dealerId) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('dealers').select('*').eq('id', dealerId).maybeSingle();
      if (error) {
        toast({ title: 'Failed to load dealer', description: error.message, variant: 'destructive' });
      }
      if (data) {
        setDealer(data);
        setForm({
          name: data.name || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
          logo_url: data.logo_url || '',
        });
      }
      setLoading(false);
    };
    void fetch();
  }, [dealerId, dealerLoading, toast]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealerId) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `dealers/${dealerId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }));
    setUploading(false);
    toast({ title: 'Logo uploaded' });
  };

  const handleSave = async () => {
    if (!dealerId) return;
    setSaving(true);

    const { error } = await supabase.from('dealers').update({
      name: form.name.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim() || null,
      logo_url: form.logo_url || null,
    }).eq('id', dealerId);

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dealership updated' });
    }
    setSaving(false);
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8">Loading...</div>;
  }

  if (!dealerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dealership Profile</CardTitle>
          <CardDescription>
            No dealership is associated with your account. Superadmins manage dealers from the dealers page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <CardTitle className="font-heading">Dealership Profile</CardTitle>
        <CardDescription>Update your dealership information and logo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
        <div className="space-y-3">
          <Label>Dealership Logo</Label>
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <div className="relative">
                <img src={form.logo_url} alt="Dealer logo" className="h-20 w-20 rounded-xl object-cover border border-border" />
                <button
                  onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                <Upload className="h-6 w-6" />
              </div>
            )}
            <div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>{uploading ? 'Uploading...' : 'Upload Logo'}</span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Dealership Name *</Label>
            <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Contact Email *</Label>
            <Input type="email" value={form.contact_email} onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input value={form.contact_phone} onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.contact_email.trim()} className="primary border-0 text-primary-foreground gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DealerProfileSettings;
