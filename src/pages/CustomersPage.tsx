import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { logStaffActivity } from '@/lib/activityLogger';
import { buildCustomer360Summary } from '@/lib/customer360';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { useAuth } from '@/hooks/useAuth';
import { CalendarClock, CheckCircle2, FileUp, Mail, MessageSquare, Phone, Search, Upload, UserPlus, UserRound } from 'lucide-react';

const VISIT_REASON_OPTIONS = [
  'Walk-in enquiry',
  'Test drive follow-up',
  'Vehicle comparison',
  'Booking discussion',
  'Finance consultation',
  'Document collection',
  'Delivery follow-up',
  'Service concern',
  'Other',
];

const TRIM_INTEREST_OPTIONS = [
  'Base',
  'Mid',
  'Top',
  'Premier',
  'Luxury',
  'F Sport',
  'Platinum',
  'Other',
];

const BUDGET_OPTIONS = [
  'No figure discussed',
  'Below AED 100k',
  'AED 100k - 200k',
  'AED 200k - 300k',
  'AED 300k - 500k',
  'Above AED 500k',
  'Needs finance plan',
];

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const CustomersPage = () => {
  const router = useRouter();
  const { user, role, profile } = useAuth();
  const customerId = typeof router.query.customerId === 'string' ? router.query.customerId : null;
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerId || null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [customerMissing, setCustomerMissing] = useState(false);
  const [createDraft, setCreateDraft] = useState({ full_name: '', phone: '', email: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [customer360ReloadKey, setCustomer360ReloadKey] = useState(0);
  const [savingVisitLog, setSavingVisitLog] = useState(false);
  const [selectedActivityItem, setSelectedActivityItem] = useState<any | null>(null);
  const [visitLogDraft, setVisitLogDraft] = useState({
    visitDate: new Date().toLocaleDateString('en-CA').split('T')[0],
    showroom: '',
    visitReason: '',
    modelInterest: '',
    trimInterest: '',
    budget: '',
    notes: '',
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const rows = await apiGet<any[]>(`/api/customers?limit=300`);
        setCustomers(rows || []);

        if (!customerId && !selectedCustomerId && (rows || []).length > 0) {
          const firstId = rows[0]?.id;
          if (firstId) {
            setSelectedCustomerId(firstId);
            void router.replace(`/customers/${firstId}`);
          }
        }
      } catch {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchCustomers();
  }, [customerId, router, selectedCustomerId]);

  useEffect(() => {
    const resolvedId = customerId || selectedCustomerId;
    if (!resolvedId) {
      setSummary(null);
      return;
    }

    const fetchCustomer360 = async () => {
      setDetailLoading(true);
      setCustomerMissing(false);
      try {
        const [customer, testDrives, communications, allEvents] = await Promise.all([
          apiGet<any>(`/api/customers/${encodeURIComponent(resolvedId)}`),
          apiGet<any[]>(`/api/test-drives?customer_id=${encodeURIComponent(resolvedId)}&limit=200`),
          apiGet<any[]>(`/api/communications?customer_id=${encodeURIComponent(resolvedId)}&limit=200`),
          apiGet<any[]>(`/api/activity/events?limit=500`),
        ]);

        const relevantEvents = (allEvents || []).filter((event: any) => {
          const metadata = event?.metadata ?? {};
          const customerIdFromMeta = metadata.customer_id || metadata.customerId;
          return customerIdFromMeta === resolvedId || event?.customer_id === resolvedId;
        });

        setSummary(buildCustomer360Summary({
          customer,
          testDrives: testDrives || [],
          communications: communications || [],
          events: relevantEvents || [],
        }));
      } catch {
        setSummary(null);
        setCustomerMissing(true);
      } finally {
        setDetailLoading(false);
      }
    };

    void fetchCustomer360();
  }, [customer360ReloadKey, customerId, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      const data = [customer.full_name, customer.phone, customer.email].filter(Boolean).join(' ').toLowerCase();
      return data.includes(q);
    });
  }, [customers, search]);

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    void router.push(`/customers/${id}`);
  };

  const handleCreateCustomer = async () => {
    const full_name = createDraft.full_name.trim();
    const phone = createDraft.phone.trim();
    const email = createDraft.email.trim().toLowerCase();

    if (!full_name || !phone) return;

    setCreatingCustomer(true);
    try {
      const created = await apiPost<any>('/api/customers', {
        full_name,
        phone,
        email: email || null,
        preferred_contact: email ? 'email' : 'phone',
      });

      setCustomers((prev) => {
        const exists = prev.some((row) => row.id === created.id);
        return exists ? prev : [created, ...prev];
      });
      setCustomerMissing(false);
      setSearch('');
      setCreateDraft({ full_name: '', phone: '', email: '' });
      setSelectedCustomerId(created.id);
      void router.push(`/customers/${created.id}`);
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleLicenseUpload = async (file?: File | null) => {
    if (!file || !currentCustomer?.id) return;

    setUploadingLicense(true);
    try {
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `customers/${currentCustomer.id}/driving-license-${Date.now()}.${extension}`;
      await uploadToStorage('documents', path, file);
      const publicUrl = await getStoragePublicUrl('documents', path);
      const updated = await apiPatch<any>(`/api/customers/${encodeURIComponent(currentCustomer.id)}`, {
        driving_license_url: publicUrl,
        driving_license_verified: false,
      });

      setSummary((prev: any) => prev ? {
        ...prev,
        customer: {
          ...prev.customer,
          ...updated,
        },
      } : prev);
    } finally {
      setUploadingLicense(false);
    }
  };

  const handleSaveVisitLog = async () => {
    if (!currentCustomer?.id || !user?.id || !profile?.id) return;

    setSavingVisitLog(true);
    try {
      await logStaffActivity({
        userId: user.id,
        profileId: profile.id,
        locationId: profile.location_id,
        role,
        eventType: 'other',
        label: 'Customer visit logged',
        route: router.asPath,
        metadata: {
          customer_id: currentCustomer.id,
          customer_name: currentCustomer.full_name || null,
          visit_date: visitLogDraft.visitDate || null,
          showroom: visitLogDraft.showroom || null,
          visit_reason: visitLogDraft.visitReason || null,
          model_interest: visitLogDraft.modelInterest || null,
          trim_interest: visitLogDraft.trimInterest || null,
          budget: visitLogDraft.budget || null,
          notes: visitLogDraft.notes || null,
        },
      });

      setVisitLogDraft({
        visitDate: new Date().toLocaleDateString('en-CA').split('T')[0],
        showroom: '',
        visitReason: '',
        modelInterest: '',
        trimInterest: '',
        budget: '',
        notes: '',
      });
      setCustomer360ReloadKey((value) => value + 1);
    } finally {
      setSavingVisitLog(false);
    }
  };

  const currentCustomer = summary?.customer || null;
  const allActivityItems = summary?.timeline || [];
  const loggedVisitItems = useMemo(
    () => allActivityItems.filter((item: any) => item.title === 'Customer visit logged' || Boolean(item?.metadata?.visit_reason)),
    [allActivityItems],
  );
  const showroomOptions = useMemo(() => {
    const set = new Set<string>();
    for (const drive of summary?.testDrives || []) {
      const locationName = String(drive?.locations?.name || drive?.location_name || '').trim();
      if (locationName) set.add(locationName);
    }
    if (profile?.location_name) set.add(String(profile.location_name).trim());
    return Array.from(set).sort((left, right) => left.localeCompare(right));
  }, [profile?.location_name, summary?.testDrives]);
  const modelInterestOptions = useMemo(() => {
    const set = new Set<string>();
    for (const drive of summary?.testDrives || []) {
      const vehicleName = [drive?.vehicles?.brand, drive?.vehicles?.model, drive?.vehicle_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (vehicleName) set.add(vehicleName);
    }
    return Array.from(set).sort((left, right) => left.localeCompare(right));
  }, [summary?.testDrives]);

  const summaryCards = [
    {
      label: 'Phone',
      value: currentCustomer?.phone || '—',
      icon: Phone,
      className: 'border-border bg-card',
      iconClassName: 'bg-primary/10 text-primary',
    },
    {
      label: 'Email',
      value: currentCustomer?.email || '—',
      icon: Mail,
      className: 'border-border bg-card',
      iconClassName: 'bg-primary/10 text-primary',
    },
    {
      label: 'Joined',
      value: formatDateTime(currentCustomer?.created_at),
      icon: CalendarClock,
      className: 'border-border bg-card',
      iconClassName: 'bg-primary/10 text-primary',
    },
  ];

  const detailRows = selectedActivityItem
    ? [
        { label: 'Type', value: selectedActivityItem.type || '—' },
        { label: 'Source', value: selectedActivityItem.source || '—' },
        { label: 'Status', value: selectedActivityItem.status || '—' },
        { label: 'Time', value: formatDateTime(selectedActivityItem.timestamp) },
        { label: 'Showroom', value: String(selectedActivityItem.metadata?.showroom || '—') },
        { label: 'Visit reason', value: String(selectedActivityItem.metadata?.visit_reason || '—') },
        { label: 'Model of interest', value: String(selectedActivityItem.metadata?.model_interest || '—') },
        { label: 'Trim of interest', value: String(selectedActivityItem.metadata?.trim_interest || '—') },
        { label: 'Budget', value: String(selectedActivityItem.metadata?.budget || '—') },
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Customers</h1>
            <p className="text-sm text-muted-foreground">Customer 360 view with activity timeline, communications, and test-drive history</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer" className="pl-9" />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="shadow-card border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              {loading ? (
                <div className="py-8 text-sm text-muted-foreground text-center">Loading customers…</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="space-y-4 py-8 text-center">
                  <div className="text-sm text-muted-foreground">No customers found</div>
                  <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left">
                    <p className="text-sm font-semibold text-foreground">Create a new customer</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add the customer here when no existing record matches your search.</p>
                    <div className="mt-3 space-y-2">
                      <Input
                        placeholder="Full name"
                        value={createDraft.full_name}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, full_name: event.target.value }))}
                      />
                      <Input
                        placeholder="Phone"
                        value={createDraft.phone}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                      <Input
                        placeholder="Email"
                        value={createDraft.email}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, email: event.target.value }))}
                      />
                      <Button className="w-full" onClick={() => void handleCreateCustomer()} disabled={creatingCustomer || !createDraft.full_name.trim() || !createDraft.phone.trim()}>
                        <UserPlus className="h-4 w-4" /> {creatingCustomer ? 'Creating…' : 'Create and open customer'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelectCustomer(customer.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all duration-200 ${selectedCustomerId === customer.id ? 'border-primary/40 bg-primary/10 shadow-sm' : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{customer.full_name || 'Unnamed customer'}</p>
                        <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">{customer.preferred_contact || 'phone'}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      <span className="truncate">{customer.email || 'No email'}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card min-h-[540px] border border-border bg-card">
            <CardContent className="p-0">
              {detailLoading ? (
                <div className="flex min-h-[540px] items-center justify-center text-sm text-muted-foreground">Loading customer activity…</div>
              ) : customerMissing ? (
                <div className="flex min-h-[540px] items-center justify-center p-6">
                  <div className="w-full max-w-md rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-6">
                    <p className="text-lg font-heading font-bold text-foreground">Customer not found</p>
                    <p className="mt-2 text-sm text-muted-foreground">This customer record does not exist yet. Create a new customer and open their profile.</p>
                    <div className="mt-4 space-y-3">
                      <Input
                        placeholder="Full name"
                        value={createDraft.full_name}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, full_name: event.target.value }))}
                      />
                      <Input
                        placeholder="Phone"
                        value={createDraft.phone}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                      <Input
                        placeholder="Email"
                        value={createDraft.email}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, email: event.target.value }))}
                      />
                      <Button className="w-full" onClick={() => void handleCreateCustomer()} disabled={creatingCustomer || !createDraft.full_name.trim() || !createDraft.phone.trim()}>
                        <UserPlus className="h-4 w-4" /> {creatingCustomer ? 'Creating…' : 'Create a new customer'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : !summary || !currentCustomer ? (
                <div className="flex min-h-[540px] items-center justify-center text-sm text-muted-foreground">Select a customer to view their 360 profile</div>
              ) : (
                <div className="space-y-6 p-4 sm:p-6">
                  <div className="rounded-3xl border border-primary/20 bg-primary p-5 text-primary-foreground shadow-lg">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-sm">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{currentCustomer.full_name || 'Customer'}</h2>
                          <p className="text-sm text-primary-foreground/80">Customer ID: {currentCustomer.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/20">{summary.metrics.totalActivities} activities</Badge>
                        <Badge className="bg-white/20 text-white ring-1 ring-white/30 hover:bg-white/30">{summary.metrics.activeTestDrives} active drives</Badge>
                        <Badge className="bg-white/20 text-white ring-1 ring-white/30 hover:bg-white/30">{currentCustomer.driving_license_verified ? 'License verified' : currentCustomer.driving_license_url ? 'License uploaded' : 'License pending'}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {summaryCards.map(({ label, value, icon: Icon, className, iconClassName }) => (
                      <div key={label} className={`rounded-2xl border ${className} p-4`}>
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconClassName}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-foreground break-words">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">All Activities</h3>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">{allActivityItems.length}</Badge>
                      </div>
                      <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                        {allActivityItems.map((item: any) => {
                          const iconConfig = {
                            communication: { icon: MessageSquare, className: 'bg-primary/10 text-primary' },
                            test_drive: { icon: CalendarClock, className: 'bg-primary/10 text-primary' },
                            default: { icon: CheckCircle2, className: 'bg-primary/10 text-primary' },
                          };
                          const tile = iconConfig[item.type as keyof typeof iconConfig] || iconConfig.default;
                          const IconTile = tile.icon;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedActivityItem(item)}
                              className="flex w-full gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
                            >
                              <div className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full ${tile.className}`}>
                                <IconTile className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-foreground">Logged Visit Logs</h3>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">{loggedVisitItems.length}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {loggedVisitItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No manual visit logs yet.</p>
                          ) : (
                            loggedVisitItems.map((item: any) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedActivityItem(item)}
                                className="w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium text-foreground">{item.metadata?.visit_reason || item.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{item.metadata?.showroom || 'Showroom not set'} • {item.metadata?.model_interest || 'Model not set'}</p>
                                  </div>
                                  <Badge variant="secondary" className="bg-primary/10 text-primary">View</Badge>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-foreground">Log Visit Activity</h3>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">GRO / Sales</Badge>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="visit-date">Visit date</Label>
                            <Input
                              id="visit-date"
                              type="date"
                              value={visitLogDraft.visitDate}
                              onChange={(event) => setVisitLogDraft((prev) => ({ ...prev, visitDate: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visit-showroom">Showroom</Label>
                            <Select value={visitLogDraft.showroom} onValueChange={(value) => setVisitLogDraft((prev) => ({ ...prev, showroom: value }))}>
                              <SelectTrigger id="visit-showroom">
                                <SelectValue placeholder="Select showroom" />
                              </SelectTrigger>
                              <SelectContent>
                                {showroomOptions.length === 0 ? (
                                  <SelectItem value="General showroom">General showroom</SelectItem>
                                ) : (
                                  showroomOptions.map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visit-reason">Visit reason</Label>
                            <Select value={visitLogDraft.visitReason} onValueChange={(value) => setVisitLogDraft((prev) => ({ ...prev, visitReason: value }))}>
                              <SelectTrigger id="visit-reason">
                                <SelectValue placeholder="Select visit reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {VISIT_REASON_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visit-model">Model of interest</Label>
                            <Select value={visitLogDraft.modelInterest} onValueChange={(value) => setVisitLogDraft((prev) => ({ ...prev, modelInterest: value }))}>
                              <SelectTrigger id="visit-model">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {modelInterestOptions.length === 0 ? (
                                  <SelectItem value="General enquiry">General enquiry</SelectItem>
                                ) : (
                                  modelInterestOptions.map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visit-trim">Trim of interest</Label>
                            <Select value={visitLogDraft.trimInterest} onValueChange={(value) => setVisitLogDraft((prev) => ({ ...prev, trimInterest: value }))}>
                              <SelectTrigger id="visit-trim">
                                <SelectValue placeholder="Select trim" />
                              </SelectTrigger>
                              <SelectContent>
                                {TRIM_INTEREST_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visit-budget">Budget</Label>
                            <Select value={visitLogDraft.budget} onValueChange={(value) => setVisitLogDraft((prev) => ({ ...prev, budget: value }))}>
                              <SelectTrigger id="visit-budget">
                                <SelectValue placeholder="Select budget" />
                              </SelectTrigger>
                              <SelectContent>
                                {BUDGET_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="visit-notes">Notes</Label>
                            <Textarea
                              id="visit-notes"
                              placeholder="Add what happened during this visit so it appears in customer activities."
                              value={visitLogDraft.notes}
                              onChange={(event) => setVisitLogDraft((prev) => ({ ...prev, notes: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button onClick={() => void handleSaveVisitLog()} disabled={savingVisitLog || !visitLogDraft.visitReason.trim()}>
                            {savingVisitLog ? 'Saving…' : 'Save visit activity'}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-foreground">Documents</h3>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {currentCustomer.driving_license_url ? '1 uploaded' : 'No documents'}
                          </Badge>
                        </div>
                        <div className="mt-3 rounded-xl border border-border bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">Driving licence</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {currentCustomer.driving_license_url
                                  ? currentCustomer.driving_license_verified
                                    ? 'Uploaded and verified.'
                                    : 'Uploaded and waiting for verification.'
                                  : 'No driving licence uploaded yet.'}
                              </p>
                            </div>
                            <Badge variant="secondary" className={currentCustomer.driving_license_verified ? 'bg-success/10 text-success' : currentCustomer.driving_license_url ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}>
                              {currentCustomer.driving_license_verified ? 'Verified' : currentCustomer.driving_license_url ? 'Pending' : 'Missing'}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {currentCustomer.driving_license_url && (
                              <Button variant="outline" onClick={() => window.open(currentCustomer.driving_license_url, '_blank')}>
                                <FileUp className="h-4 w-4" /> View document
                              </Button>
                            )}
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-muted/30">
                              <Upload className="h-4 w-4" /> {uploadingLicense ? 'Uploading…' : currentCustomer.driving_license_url ? 'Replace document' : 'Upload document'}
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                disabled={uploadingLicense}
                                onChange={(event) => {
                                  const file = event.target.files?.[0] || null;
                                  void handleLicenseUpload(file);
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">Recent test drives</h3>
                        <div className="mt-3 space-y-2">
                          {summary.testDrives.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No test drives recorded</p>
                          ) : (
                            summary.testDrives.slice(0, 5).map((testDrive: any) => (
                              <div key={testDrive.id} className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-foreground">{testDrive.status || 'scheduled'}</span>
                                  <Badge variant="secondary" className="capitalize bg-primary/10 text-primary">{testDrive.status || 'scheduled'}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">{testDrive.scheduled_date || '—'} • {testDrive.scheduled_time || '—'}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">Recent communications</h3>
                        <div className="mt-3 space-y-2">
                          {summary.communications.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No communications recorded</p>
                          ) : (
                            summary.communications.slice(0, 5).map((communication: any) => (
                              <div key={communication.id} className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-foreground capitalize">{communication.type || 'message'}</span>
                                  <Badge variant="secondary" className="capitalize bg-primary/10 text-primary">{communication.status || 'sent'}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">{communication.purpose || 'communication'} • {communication.sent_to || 'customer'}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => void router.push('/customers')} variant="outline">Back to list</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={!!selectedActivityItem} onOpenChange={(open) => !open && setSelectedActivityItem(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedActivityItem && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedActivityItem.title}</SheetTitle>
                <SheetDescription>{selectedActivityItem.description}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {detailRows.map((row) => (
                    <div key={row.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{row.label}</p>
                      <p className="mt-2 text-sm font-medium text-foreground break-words">{row.value}</p>
                    </div>
                  ))}
                </div>

                {selectedActivityItem.metadata?.notes && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Notes</p>
                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{String(selectedActivityItem.metadata.notes)}</p>
                  </div>
                )}

                {selectedActivityItem.raw && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Raw details</p>
                    <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(selectedActivityItem.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default CustomersPage;
