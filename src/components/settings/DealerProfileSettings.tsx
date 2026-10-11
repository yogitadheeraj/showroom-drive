import { useState, useEffect } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery, apiGet, apiPatch, apiPost, apiPut } from '@/lib/apiClient';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { navigateTo } from '@/lib/browserNavigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X, Building2, Users, MapPin, CarFront, CalendarCheck, Wrench } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const SUBSCRIPTION_PACKAGES = ['Free Package', 'Starter 5', 'Smart 100', 'Full Functionality'];
const BILLING_PERIODS = ['monthly', 'yearly'] as const;
const DASHBOARD_PREFS_KEY = 'dashboard_superadmin_prefs_v1';

const formatExpiryDate = (value: string) => {
  if (!value) return 'Not set';
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getExpiryStatus = (expiryDate: string) => {
  if (!expiryDate) {
    return {
      text: 'No expiry set',
      className: 'border-border/70 bg-muted text-muted-foreground',
    };
  }

  const today = new Date();
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = expiry.getTime() - startOfToday.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (Number.isNaN(days)) {
    return {
      text: 'Invalid date',
      className: 'border-destructive/40 bg-destructive/10 text-destructive',
    };
  }

  if (days < 0) {
    return {
      text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
      className: 'border-destructive/40 bg-destructive/10 text-destructive',
    };
  }

  if (days === 0) {
    return {
      text: 'Expires today',
      className: 'border-amber-300/70 bg-amber-100/60 text-amber-800 dark:border-amber-700/70 dark:bg-amber-900/25 dark:text-amber-200',
    };
  }

  if (days <= 7) {
    return {
      text: `${days} day${days === 1 ? '' : 's'} left`,
      className: 'border-amber-300/70 bg-amber-100/60 text-amber-800 dark:border-amber-700/70 dark:bg-amber-900/25 dark:text-amber-200',
    };
  }

  return {
    text: `${days} day${days === 1 ? '' : 's'} left`,
    className: 'border-emerald-300/70 bg-emerald-100/60 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-900/25 dark:text-emerald-200',
  };
};

const DealerProfileSettings = ({ dealerIdOverride }: { dealerIdOverride?: string } = {}) => {
  const { dealerId: ctxDealerId, loading: dealerLoading } = useDealerContext();
  const dealerId = dealerIdOverride || ctxDealerId;
  const { user, role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dealer, setDealer] = useState<any>(null);
  const [allDealers, setAllDealers] = useState<any[]>([]);
  const [subscription, setSubscription] = useState({
    package_name: 'Free Package',
    billing_period: 'monthly' as 'monthly' | 'yearly',
    expires_at: '',
  });
  const [allDealerSubscriptions, setAllDealerSubscriptions] = useState<Record<string, { package_name: string; billing_period: 'monthly' | 'yearly'; expires_at: string; saving?: boolean }>>({});
  const [dealerCanvasOpen, setDealerCanvasOpen] = useState(false);
  const [selectedDealerForCanvas, setSelectedDealerForCanvas] = useState<any | null>(null);
  const [dealerInsights, setDealerInsights] = useState<Record<string, {
    loading: boolean;
    locations: number;
    staff: number;
    vehicles: number;
    test_drives: number;
    service_bookings: number;
  }>>({});
  const [dealerPendingRequestCounts, setDealerPendingRequestCounts] = useState<Record<string, number>>({});
  const [subscriptionRequestNote, setSubscriptionRequestNote] = useState('');
  const [subscriptionRequestSaving, setSubscriptionRequestSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    logo_url: '',
    primary_color: '',
    tagline: '',
    gst_number: '',
    pan_number: '',
    invoice_terms: '',
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    contact_email: '',
    contact_phone: '',
    gst_number: '',
    pan_number: '',
    invoice_terms: '',
  });

  useEffect(() => {
    if (dealerLoading) return;
    if (!dealerId) {
      setLoading(false);
      if (isSuperAdmin) {
        // Load all dealers for superadmin
        apiDbQuery<any[]>({
          table: 'dealers',
          action: 'select',
          select: 'id, name, slug, contact_email, contact_phone, logo_url, created_at',
          order: [{ field: 'name', ascending: true }],
        }).then(d => setAllDealers(d ?? []));
      } else if (user?.email) {
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
          primary_color: data.primary_color || '',
          tagline: data.tagline || '',
          gst_number: data.gst_number || '',
          pan_number: data.pan_number || '',
          invoice_terms: data.invoice_terms || '',
        });
        try {
          const subscriptionData = await apiGet<any>(`/api/dealers/${data.id}/subscription`);
          setSubscription({
            package_name: subscriptionData?.package_name || 'Free Package',
            billing_period: subscriptionData?.billing_period === 'yearly' ? 'yearly' : 'monthly',
            expires_at: typeof subscriptionData?.expires_at === 'string' ? subscriptionData.expires_at.slice(0, 10) : '',
          });
        } catch {
          setSubscription({ package_name: 'Free Package', billing_period: 'monthly', expires_at: '' });
        }
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

    await apiPatch(`/api/dealers/${dealerId}`, {
      name: form.name.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim() || null,
      logo_url: form.logo_url || null,
      primary_color: form.primary_color.trim() || null,
      tagline: form.tagline.trim() || null,
      gst_number: form.gst_number.trim() || null,
      pan_number: form.pan_number.trim() || null,
      invoice_terms: form.invoice_terms.trim() || null,
    });

    if (isSuperAdmin) {
      await apiPut(`/api/dealers/${dealerId}/subscription`, {
        package_name: subscription.package_name,
        billing_period: subscription.billing_period,
        expires_at: subscription.expires_at || null,
        is_active: true,
      });
    }

    toast({ title: 'Dealership updated' });
    setSaving(false);
  };

  const canRequestSubscriptionChange = role === APP_ROLE.BRAND_ADMIN || role === APP_ROLE.SALES_ADMIN;

  const handleRequestSubscriptionChange = async () => {
    if (!dealerId || !canRequestSubscriptionChange) return;
    setSubscriptionRequestSaving(true);
    try {
      await apiPost(`/api/dealers/${dealerId}/subscription-requests`, {
        package_name: subscription.package_name,
        billing_period: subscription.billing_period,
        note: subscriptionRequestNote.trim() || null,
      });
      setSubscriptionRequestNote('');
      toast({ title: 'Request sent', description: 'Subscription change request sent to Super Admin.' });
    } catch (error: any) {
      toast({ title: 'Request failed', description: error?.message || 'Could not send request', variant: 'destructive' });
    } finally {
      setSubscriptionRequestSaving(false);
    }
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
    await apiPost('/api/dealers', {
      name,
      slug,
      contact_email: email,
      contact_phone: createForm.contact_phone.trim() || null,
      gst_number: createForm.gst_number.trim() || null,
      pan_number: createForm.pan_number.trim() || null,
      invoice_terms: createForm.invoice_terms.trim() || null,
      admin_user_id: user.id,
    });
    toast({ title: 'Dealership created', description: 'Reloading your settings…' });
    setTimeout(() => window.location.reload(), 600);
  };

  useEffect(() => {
    if (!isSuperAdmin || allDealers.length === 0 || dealerId) return;
    let cancelled = false;

    const loadSubscriptions = async () => {
      const entries = await Promise.all(
        allDealers.map(async (d) => {
          try {
            const sub = await apiGet<any>(`/api/dealers/${d.id}/subscription`);
            return [
              d.id,
              {
                package_name: sub?.package_name || 'Free Package',
                billing_period: sub?.billing_period === 'yearly' ? 'yearly' : 'monthly',
                expires_at: typeof sub?.expires_at === 'string' ? sub.expires_at.slice(0, 10) : '',
                saving: false,
              },
            ] as const;
          } catch {
            return [
              d.id,
              {
                package_name: 'Free Package',
                billing_period: 'monthly' as const,
                expires_at: '',
                saving: false,
              },
            ] as const;
          }
        })
      );
      if (cancelled) return;
      setAllDealerSubscriptions(Object.fromEntries(entries));
    };

    void loadSubscriptions();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, allDealers, dealerId]);

  const updateAllDealerSubscription = (
    dealerIdToUpdate: string,
    patch: Partial<{ package_name: string; billing_period: 'monthly' | 'yearly'; expires_at: string; saving: boolean }>,
  ) => {
    setAllDealerSubscriptions((prev) => ({
      ...prev,
      [dealerIdToUpdate]: {
        package_name: prev[dealerIdToUpdate]?.package_name || 'Free Package',
        billing_period: prev[dealerIdToUpdate]?.billing_period || 'monthly',
        expires_at: prev[dealerIdToUpdate]?.expires_at || '',
        saving: prev[dealerIdToUpdate]?.saving || false,
        ...patch,
      },
    }));
  };

  const saveAllDealerSubscription = async (dealerIdToSave: string) => {
    const sub = allDealerSubscriptions[dealerIdToSave];
    if (!sub) return;

    updateAllDealerSubscription(dealerIdToSave, { saving: true });
    try {
      await apiPut(`/api/dealers/${dealerIdToSave}/subscription`, {
        package_name: sub.package_name,
        billing_period: sub.billing_period,
        expires_at: sub.expires_at || null,
        is_active: true,
      });
      toast({ title: 'Subscription saved' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Could not update subscription.', variant: 'destructive' });
    } finally {
      updateAllDealerSubscription(dealerIdToSave, { saving: false });
    }
  };

  const openDealerCanvas = async (dealerRow: any) => {
    setSelectedDealerForCanvas(dealerRow);
    setDealerCanvasOpen(true);

    if (dealerInsights[dealerRow.id]?.loading === false) return;

    setDealerInsights((prev) => ({
      ...prev,
      [dealerRow.id]: {
        loading: true,
        locations: prev[dealerRow.id]?.locations || 0,
        staff: prev[dealerRow.id]?.staff || 0,
        vehicles: prev[dealerRow.id]?.vehicles || 0,
        test_drives: prev[dealerRow.id]?.test_drives || 0,
        service_bookings: prev[dealerRow.id]?.service_bookings || 0,
      },
    }));

    try {
      const pendingRequests = await apiGet<any[]>(`/api/subscription-requests?dealer_id=${dealerRow.id}&status=pending`).catch(() => []);
      setDealerPendingRequestCounts((prev) => ({ ...prev, [dealerRow.id]: Array.isArray(pendingRequests) ? pendingRequests.length : 0 }));

      const locationRows = await apiDbQuery<any[]>({
        table: 'locations',
        action: 'select',
        select: 'id',
        filters: [{ field: 'dealer_id', op: 'eq', value: dealerRow.id }],
      });
      const locationIds = (locationRows || []).map((loc) => loc.id).filter(Boolean);

      const [staffRows, vehicleRows, testDriveRows, serviceRows] = await Promise.all([
        locationIds.length
          ? apiDbQuery<any[]>({
              table: 'profiles',
              action: 'select',
              select: 'id',
              filters: [{ field: 'location_id', op: 'in', value: locationIds }],
            })
          : Promise.resolve([]),
        locationIds.length
          ? apiDbQuery<any[]>({
              table: 'vehicles',
              action: 'select',
              select: 'id',
              filters: [{ field: 'location_id', op: 'in', value: locationIds }],
            })
          : Promise.resolve([]),
        locationIds.length
          ? apiDbQuery<any[]>({
              table: 'test_drives',
              action: 'select',
              select: 'id',
              filters: [{ field: 'location_id', op: 'in', value: locationIds }],
            })
          : Promise.resolve([]),
        locationIds.length
          ? apiDbQuery<any[]>({
              table: 'service_appointments',
              action: 'select',
              select: 'id',
              filters: [{ field: 'location_id', op: 'in', value: locationIds }],
            })
          : Promise.resolve([]),
      ]);

      setDealerInsights((prev) => ({
        ...prev,
        [dealerRow.id]: {
          loading: false,
          locations: locationIds.length,
          staff: (staffRows || []).length,
          vehicles: (vehicleRows || []).length,
          test_drives: (testDriveRows || []).length,
          service_bookings: (serviceRows || []).length,
        },
      }));
    } catch {
      setDealerInsights((prev) => ({
        ...prev,
        [dealerRow.id]: {
          loading: false,
          locations: prev[dealerRow.id]?.locations || 0,
          staff: prev[dealerRow.id]?.staff || 0,
          vehicles: prev[dealerRow.id]?.vehicles || 0,
          test_drives: prev[dealerRow.id]?.test_drives || 0,
          service_bookings: prev[dealerRow.id]?.service_bookings || 0,
        },
      }));
    }
  };

  const openDealerDashboard = (dealerRow: any) => {
    try {
      const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        DASHBOARD_PREFS_KEY,
        JSON.stringify({
          ...prev,
          selectedDealer: dealerRow.id,
          selectedLocation: 'all',
        }),
      );
    } catch {
      // non-blocking
    }
    navigateTo('/dashboard');
  };

  const openDealerSettings = (dealerRow: any) => {
    navigateTo(`/settings?dealerId=${encodeURIComponent(dealerRow.id)}`);
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8">Loading...</div>;
  }

  if (!dealerId && isSuperAdmin) {
    const activeDealerId = selectedDealerForCanvas?.id || '';
    const activeInsight = activeDealerId ? dealerInsights[activeDealerId] : null;
    const activeSub = activeDealerId ? allDealerSubscriptions[activeDealerId] : null;
    const activePendingRequests = activeDealerId ? (dealerPendingRequestCounts[activeDealerId] || 0) : 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">All Dealers</span>
          <span className="text-xs text-muted-foreground">({allDealers.length} total)</span>
        </div>
        {allDealers.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No dealers found.</CardContent></Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
            <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(150px,1fr)] gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span>Dealer</span>
              <span>Contact</span>
              <span>Plan</span>
              <span>Expiry</span>
            </div>
            <div className="divide-y divide-border/50">
              {allDealers.map((d) => {
                const sub = allDealerSubscriptions[d.id];
                const expiryState = getExpiryStatus(sub?.expires_at || '');
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => openDealerCanvas(d)}
                    className="grid w-full grid-cols-[minmax(220px,1.6fr)_minmax(180px,1.2fr)_minmax(120px,0.8fr)_minmax(150px,1fr)] gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {d.logo_url ? (
                        <img src={d.logo_url} alt={d.name} className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">{d.name}</p>
                        {d.slug ? <p className="text-[11px] text-muted-foreground font-mono truncate">{d.slug}</p> : null}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{d.contact_email || 'No email'}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.contact_phone || 'No phone'}</p>
                    </div>
                    <div className="text-sm font-medium text-foreground">{sub?.package_name || 'Free Package'}</div>
                    <div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${expiryState.className}`}>
                        {expiryState.text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Sheet open={dealerCanvasOpen} onOpenChange={setDealerCanvasOpen}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
            {selectedDealerForCanvas ? (
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-border/60 px-6 py-5">
                  <SheetTitle className="flex items-center gap-3">
                    {selectedDealerForCanvas.logo_url ? (
                      <img src={selectedDealerForCanvas.logo_url} alt={selectedDealerForCanvas.name} className="h-9 w-9 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span>{selectedDealerForCanvas.name}</span>
                  </SheetTitle>
                  <SheetDescription>
                    {selectedDealerForCanvas.contact_email || 'No contact email'}
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick Actions</p>
                      <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                        Pending Requests: {activePendingRequests}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button type="button" variant="outline" onClick={() => openDealerDashboard(selectedDealerForCanvas)}>
                        Open Dealer Dashboard
                      </Button>
                      <Button type="button" variant="outline" onClick={() => openDealerSettings(selectedDealerForCanvas)}>
                        Open Dealer Settings
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Locations</p>
                        <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-foreground"><MapPin className="h-4 w-4 text-primary" /> {activeInsight?.loading ? '...' : activeInsight?.locations || 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Staff</p>
                        <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-foreground"><Users className="h-4 w-4 text-primary" /> {activeInsight?.loading ? '...' : activeInsight?.staff || 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Test Drives</p>
                        <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-foreground"><CalendarCheck className="h-4 w-4 text-primary" /> {activeInsight?.loading ? '...' : activeInsight?.test_drives || 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Vehicles</p>
                        <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-foreground"><CarFront className="h-4 w-4 text-primary" /> {activeInsight?.loading ? '...' : activeInsight?.vehicles || 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Service</p>
                        <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-foreground"><Wrench className="h-4 w-4 text-primary" /> {activeInsight?.loading ? '...' : activeInsight?.service_bookings || 0}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Subscription</p>
                    <div className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${getExpiryStatus(activeSub?.expires_at || '').className}`}>
                      {getExpiryStatus(activeSub?.expires_at || '').text}
                    </div>

                    <div className="space-y-2">
                      <Label>Package</Label>
                      <select
                        value={activeSub?.package_name || 'Free Package'}
                        onChange={(e) => updateAllDealerSubscription(activeDealerId, { package_name: e.target.value })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {SUBSCRIPTION_PACKAGES.map((pkg) => (
                          <option key={pkg} value={pkg}>{pkg}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing (month/year)</Label>
                      <select
                        value={activeSub?.billing_period || 'monthly'}
                        onChange={(e) => updateAllDealerSubscription(activeDealerId, { billing_period: e.target.value as 'monthly' | 'yearly' })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {BILLING_PERIODS.map((period) => (
                          <option key={period} value={period} className="capitalize">{period}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input
                        type="date"
                        value={activeSub?.expires_at || ''}
                        onChange={(e) => updateAllDealerSubscription(activeDealerId, { expires_at: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => saveAllDealerSubscription(activeDealerId)}
                      disabled={Boolean(activeSub?.saving)}
                      className="w-full"
                    >
                      {activeSub?.saving ? 'Saving...' : 'Save Subscription'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    );
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
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input
                value={createForm.gst_number}
                onChange={e => setCreateForm(prev => ({ ...prev, gst_number: e.target.value }))}
                placeholder="e.g. 29ABCDE1234F1Z5"
              />
            </div>
            <div className="space-y-2">
              <Label>PAN Number</Label>
              <Input
                value={createForm.pan_number}
                onChange={e => setCreateForm(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                placeholder="e.g. ABCDE1234F"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Invoice Terms</Label>
            <Textarea
              value={createForm.invoice_terms}
              onChange={e => setCreateForm(prev => ({ ...prev, invoice_terms: e.target.value }))}
              placeholder="Payment terms, tax notes, delivery clauses, and invoice footer content"
              className="min-h-24"
            />
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
          <div className="space-y-2">
            <Label>Primary Brand Color</Label>
            <Input value={form.primary_color} onChange={e => setForm(prev => ({ ...prev, primary_color: e.target.value }))} placeholder="#2563eb" />
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={e => setForm(prev => ({ ...prev, tagline: e.target.value }))} placeholder="A premium dealership experience" />
          </div>
          <div className="space-y-2">
            <Label>GST Number</Label>
            <Input value={form.gst_number} onChange={e => setForm(prev => ({ ...prev, gst_number: e.target.value }))} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div className="space-y-2">
            <Label>PAN Number</Label>
            <Input value={form.pan_number} onChange={e => setForm(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Invoice Terms</Label>
          <Textarea
            value={form.invoice_terms}
            onChange={e => setForm(prev => ({ ...prev, invoice_terms: e.target.value }))}
            placeholder="Delivery, tax, registration, finance and invoice terms shown in customer invoice PDFs"
            className="min-h-28"
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Subscription</h3>
            <p className="text-xs text-muted-foreground">Subscription changes are managed by Super Admin. Brand/Branch admins can raise requests.</p>
          </div>
          {isSuperAdmin ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Package Name</Label>
                <select
                  value={subscription.package_name}
                  onChange={e => setSubscription(prev => ({ ...prev, package_name: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {SUBSCRIPTION_PACKAGES.map((pkg) => (
                    <option key={pkg} value={pkg}>{pkg}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Billing Period</Label>
                <select
                  value={subscription.billing_period}
                  onChange={e => setSubscription(prev => ({ ...prev, billing_period: e.target.value as 'monthly' | 'yearly' }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {BILLING_PERIODS.map((period) => (
                    <option key={period} value={period} className="capitalize">{period}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={subscription.expires_at}
                  onChange={e => setSubscription(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Current Expiry:</span> {formatExpiryDate(subscription.expires_at)}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{canRequestSubscriptionChange ? 'Requested Package' : 'Package Name'}</Label>
                  <select
                    value={subscription.package_name}
                    onChange={e => setSubscription(prev => ({ ...prev, package_name: e.target.value }))}
                    disabled={!canRequestSubscriptionChange}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {SUBSCRIPTION_PACKAGES.map((pkg) => (
                      <option key={pkg} value={pkg}>{pkg}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{canRequestSubscriptionChange ? 'Requested Billing Period' : 'Billing Period'}</Label>
                  <select
                    value={subscription.billing_period}
                    onChange={e => setSubscription(prev => ({ ...prev, billing_period: e.target.value as 'monthly' | 'yearly' }))}
                    disabled={!canRequestSubscriptionChange}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {BILLING_PERIODS.map((period) => (
                      <option key={period} value={period} className="capitalize">{period}</option>
                    ))}
                  </select>
                </div>
              </div>
              {canRequestSubscriptionChange ? (
                <>
                  <div className="space-y-2">
                    <Label>Request Note (optional)</Label>
                    <Input
                      value={subscriptionRequestNote}
                      onChange={e => setSubscriptionRequestNote(e.target.value)}
                      placeholder="Reason for the requested change"
                    />
                  </div>
                  <div>
                    <Button type="button" variant="outline" onClick={handleRequestSubscriptionChange} disabled={subscriptionRequestSaving}>
                      {subscriptionRequestSaving ? 'Sending...' : 'Send Subscription Change Request'}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}
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
