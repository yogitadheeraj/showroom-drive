import { useState, useEffect } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery } from '@/lib/apiClient';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X, Building2 } from 'lucide-react';

const DealerProfileSettings = () => {
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dealer, setDealer] = useState<any>(null);
  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', logo_url: '' });
  const [createForm, setCreateForm] = useState({ name: '', slug: '', contact_email: '', contact_phone: '' });

  useEffect(() => {
    if (dealerLoading) return;
    if (!dealerId) {
      setLoading(false);
      // Pre-fill create form with the user's email
      if (user?.email) {
        setCreateForm(prev => ({ ...prev, contact_email: prev.contact_email || user.email || '' }));
      }
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const dealers = await apiDbQuery<any[]>({
        table: 'dealers',
        action: 'select',
        select: '*',
        filters: [{ field: 'id', op: 'eq', value: dealerId }],
        limit: 1,
      });
      const data = dealers?.[0] || null;
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
  }, [dealerId, dealerLoading, toast, user?.email]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealerId) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `dealers/${dealerId}/logo.${ext}`;

    try {
      await uploadToStorage('logos', path, file, { upsert: true });
      const publicUrl = await getStoragePublicUrl('logos', path);
      setForm(prev => ({ ...prev, logo_url: publicUrl }));
      toast({ title: 'Logo uploaded' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error?.message || 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!dealerId) return;
    setSaving(true);

    await apiDbQuery({
      table: 'dealers',
      action: 'update',
      payload: {
        name: form.name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim() || null,
        logo_url: form.logo_url || null,
      },
      filters: [{ field: 'id', op: 'eq', value: dealerId }],
    });

    toast({ title: 'Dealership updated' });
    setSaving(false);
  };

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

  const handleCreateDealer = async () => {
    if (!user) return;
    const name = createForm.name.trim();
    const email = createForm.contact_email.trim();
    const slug = (createForm.slug.trim() || slugify(name));
    if (!name || !email || !slug) {
      toast({ title: 'Missing fields', description: 'Name, slug and contact email are required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    await apiDbQuery({
      table: 'dealers',
      action: 'insert',
      payload: {
        name,
        slug,
        contact_email: email,
        contact_phone: createForm.contact_phone.trim() || null,
        admin_user_id: user.id,
      },
    });
    toast({ title: 'Dealership created', description: 'Reloading your settings…' });
    setTimeout(() => window.location.reload(), 600);
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8">Loading...</div>;
  }

  if (!dealerId) {
    return (
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Set Up Your Dealership
          </CardTitle>
          <CardDescription>
            No dealership is linked to your account yet. Create one below to unlock brand settings, locations, and reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dealership Name *</Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(prev => ({
                  ...prev,
                  name: e.target.value,
                  slug: prev.slug || slugify(e.target.value),
                }))}
                placeholder="e.g. ABC Motors"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input
                value={createForm.slug}
                onChange={e => setCreateForm(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                placeholder="abc-motors"
              />
              <p className="text-xs text-muted-foreground">Used in your public booking URL.</p>
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <Input
                type="email"
                value={createForm.contact_email}
                onChange={e => setCreateForm(prev => ({ ...prev, contact_email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={createForm.contact_phone}
                onChange={e => setCreateForm(prev => ({ ...prev, contact_phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCreateDealer}
              disabled={creating || !createForm.name.trim() || !createForm.contact_email.trim() || !createForm.slug.trim()}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {creating ? 'Creating…' : 'Create Dealership'}
            </Button>
          </div>
        </CardContent>
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
