import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import { apiGet } from '@/lib/apiClient';
import { createCustomer } from '@/lib/customerService';
import { logStaffActivity } from '@/lib/activityLogger';
import { buildCustomer360Summary, Customer360Item } from '@/lib/customer360';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import WalkinDialog from '@/components/WalkinDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, CheckCircle2, ClipboardList, Loader2, Mail, Phone, Search, UserPlus, UserRound, X } from 'lucide-react';

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

type Customer360Summary = ReturnType<typeof buildCustomer360Summary>;

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const CustomerSearch360 = () => {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<Customer360Summary | null>(null);
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [loading360, setLoading360] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [visitReason, setVisitReason] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({ fullName: '', phone: '', email: '' });
  const [creating, setCreating] = useState(false);

  const customer = summary?.customer || null;

  const loadCustomer360 = useCallback(async (customerId: string) => {
    setLoading360(true);
    try {
      const [customerDoc, tdRows, commRows, eventRows] = await Promise.all([
        apiGet<any>(`/api/customers/${customerId}`),
        apiGet<any[]>(`/api/test-drives?customer_id=${encodeURIComponent(customerId)}&limit=200`),
        apiGet<any[]>(`/api/communications?customer_id=${encodeURIComponent(customerId)}&limit=200`),
        apiGet<any[]>('/api/activity/events?limit=500').catch(() => []),
      ]);
      const events = (eventRows || []).filter((e: any) => e?.metadata?.customer_id === customerId);
      setTestDrives(tdRows || []);
      setSummary(buildCustomer360Summary({
        customer: customerDoc,
        testDrives: tdRows || [],
        communications: commRows || [],
        events,
      }));
    } catch (err: any) {
      toast({ title: 'Failed to load customer 360', description: err.message, variant: 'destructive' });
    } finally {
      setLoading360(false);
    }
  }, [toast]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSummary(null);
    setTestDrives([]);
    setCreateOpen(false);
    try {
      const rows = await apiGet<any[]>(`/api/customers?search=${encodeURIComponent(term)}&limit=10`);
      setResults(rows || []);
      if ((rows || []).length === 1) {
        await loadCustomer360(rows[0].id);
      }
    } catch (err: any) {
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCustomer = async (id: string) => {
    await loadCustomer360(id);
  };

  const handleLogVisit = async () => {
    if (!customer?.id || !user?.id || !profile?.id || !visitReason) return;
    setSavingVisit(true);
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
          customer_id: customer.id,
          customer_name: customer.full_name || null,
          visit_date: new Date().toLocaleDateString('en-CA'),
          visit_reason: visitReason,
          notes: visitNotes || null,
        },
      });
      toast({ title: 'Visit logged', description: `${visitReason} recorded for ${customer.full_name || 'customer'}.` });
      setVisitReason('');
      setVisitNotes('');
      await loadCustomer360(customer.id);
    } catch (err: any) {
      toast({ title: 'Failed to log visit', description: err.message, variant: 'destructive' });
    } finally {
      setSavingVisit(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!createDraft.fullName.trim() || !createDraft.phone.trim()) {
      toast({ title: 'Name and phone required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const created = await createCustomer({
        full_name: createDraft.fullName.trim(),
        phone: createDraft.phone.trim(),
        email: createDraft.email.trim() || null,
        preferred_contact: 'phone',
      });
      toast({ title: 'Customer created', description: created?.full_name || 'New customer added.' });
      setCreateOpen(false);
      setResults(created ? [created] : []);
      if (created?.id) await loadCustomer360(created.id);
    } catch (err: any) {
      toast({ title: 'Failed to create customer', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const clearSelection = () => {
    setSummary(null);
    setTestDrives([]);
    setResults(null);
    setQuery('');
    setCreateOpen(false);
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-card shadow-card">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Customer search</p>
            <h2 className="text-lg font-heading font-bold text-foreground">Find customer by email or phone</h2>
          </div>
          {(summary || results) && (
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter customer email or phone number…"
            className="h-11 flex-1"
            type="text"
          />
          <Button type="submit" className="h-11 px-5" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Search
          </Button>
        </form>

        {/* Search results */}
        {results && !summary && !loading360 && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">No customer found for "{query.trim()}".</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const isEmail = query.includes('@');
                    setCreateDraft({
                      fullName: '',
                      phone: isEmail ? '' : query.trim(),
                      email: isEmail ? query.trim() : '',
                    });
                    setCreateOpen(true);
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Create new customer
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border">
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{c.full_name || 'Unnamed customer'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.phone || '—'}{c.email ? ` · ${c.email}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">View 360</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create customer form */}
        {createOpen && (
          <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground">New customer</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="cs-name">Full name</Label>
                <Input id="cs-name" value={createDraft.fullName} onChange={(e) => setCreateDraft((d) => ({ ...d, fullName: e.target.value }))} placeholder="Customer name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cs-phone">Phone</Label>
                <Input id="cs-phone" value={createDraft.phone} onChange={(e) => setCreateDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+971…" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cs-email">Email</Label>
                <Input id="cs-email" type="email" value={createDraft.email} onChange={(e) => setCreateDraft((d) => ({ ...d, email: e.target.value }))} placeholder="name@email.com" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateCustomer} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save customer
              </Button>
            </div>
          </div>
        )}

        {loading360 && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customer 360…
          </div>
        )}

        {/* Customer 360 */}
        {summary && customer && !loading360 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">{customer.full_name || 'Unnamed customer'}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone || '—'}</span>
                    <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email || '—'}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setBookingOpen(true)}>
                  <CalendarClock className="mr-1.5 h-4 w-4" /> Book test drive
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push(`/customers/${customer.id}`)}>
                  Open full 360
                </Button>
              </div>
            </div>

            {/* Test drives */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Test drives <span className="text-muted-foreground font-normal">({testDrives.length})</span>
              </p>
              {testDrives.length === 0 ? (
                <p className="text-xs text-muted-foreground">No test drives booked for this customer yet.</p>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border">
                  {testDrives.slice(0, 5).map((td: any) => (
                    <div key={td.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {td.vehicle_name || td.vehicle_model || 'Vehicle'} · {td.scheduled_date || '—'} {td.scheduled_time || ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{td.location_name || td.location_id || ''}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{td.status || 'scheduled'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Log visit (why customer came) */}
            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" /> Why did the customer come?
              </p>
              <div className="grid gap-3 sm:grid-cols-[220px_1fr_auto]">
                <Select value={visitReason} onValueChange={setVisitReason}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select visit reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_REASON_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Notes (optional) — model interest, budget, etc."
                  className="h-10"
                />
                <Button className="h-10" onClick={handleLogVisit} disabled={!visitReason || savingVisit}>
                  {savingVisit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Log visit
                </Button>
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Recent activity</p>
              {summary.timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {summary.timeline.slice(0, 6).map((item: Customer360Item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(item.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <WalkinDialog
        open={bookingOpen}
        onClose={(submitted) => {
          setBookingOpen(false);
          if (submitted && customer?.id) loadCustomer360(customer.id);
        }}
        rebookCustomerId={customer?.id}
        rebookCustomerEmail={customer?.email}
        defaultCustomerName={customer?.full_name}
        defaultCustomerPhone={customer?.phone}
      />
    </section>
  );
};

export default CustomerSearch360;
