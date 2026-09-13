import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/apiClient';
import { buildCustomer360Summary } from '@/lib/customer360';
import { CalendarClock, CheckCircle2, Mail, MessageSquare, Phone, Search, UserRound } from 'lucide-react';

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const CustomersPage = () => {
  const router = useRouter();
  const customerId = typeof router.query.customerId === 'string' ? router.query.customerId : null;
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerId || null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');

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
      } finally {
        setDetailLoading(false);
      }
    };

    void fetchCustomer360();
  }, [customerId, selectedCustomerId]);

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

  const currentCustomer = summary?.customer || null;

  const summaryCards = [
    {
      label: 'Phone',
      value: currentCustomer?.phone || '—',
      icon: Phone,
      className: 'from-violet-500/15 via-violet-500/5 to-transparent border-violet-200 dark:border-violet-900/60',
      iconClassName: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    },
    {
      label: 'Email',
      value: currentCustomer?.email || '—',
      icon: Mail,
      className: 'from-cyan-500/15 via-cyan-500/5 to-transparent border-cyan-200 dark:border-cyan-900/60',
      iconClassName: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
    },
    {
      label: 'Joined',
      value: formatDateTime(currentCustomer?.created_at),
      icon: CalendarClock,
      className: 'from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-200 dark:border-emerald-900/60',
      iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    },
  ];

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
          <Card className="shadow-card border-0 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              {loading ? (
                <div className="py-8 text-sm text-muted-foreground text-center">Loading customers…</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-8 text-sm text-muted-foreground text-center">No customers found</div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelectCustomer(customer.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all duration-200 ${selectedCustomerId === customer.id ? 'border-violet-200 bg-gradient-to-r from-violet-500/12 via-white to-cyan-500/10 shadow-sm dark:border-violet-800 dark:from-violet-500/20 dark:to-cyan-500/10' : 'border-slate-200 bg-white/80 hover:border-violet-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/80'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{customer.full_name || 'Unnamed customer'}</p>
                        <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">{customer.preferred_contact || 'phone'}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-cyan-500" />
                      <span className="truncate">{customer.email || 'No email'}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card min-h-[540px] border-0 bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/40">
            <CardContent className="p-0">
              {detailLoading ? (
                <div className="flex min-h-[540px] items-center justify-center text-sm text-muted-foreground">Loading customer activity…</div>
              ) : !summary || !currentCustomer ? (
                <div className="flex min-h-[540px] items-center justify-center text-sm text-muted-foreground">Select a customer to view their 360 profile</div>
              ) : (
                <div className="space-y-6 p-4 sm:p-6">
                  <div className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 p-5 text-white shadow-lg dark:border-violet-800">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{currentCustomer.full_name || 'Customer'}</h2>
                          <p className="text-sm text-violet-100">Customer ID: {currentCustomer.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/20">{summary.metrics.totalActivities} activities</Badge>
                        <Badge className="bg-emerald-400/20 text-emerald-50 ring-1 ring-emerald-300/30 hover:bg-emerald-400/30">{summary.metrics.activeTestDrives} active drives</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {summaryCards.map(({ label, value, icon: Icon, className, iconClassName }) => (
                      <div key={label} className={`rounded-2xl border bg-gradient-to-br ${className} p-4`}>
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

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void router.push(`/test-drives?customer_id=${encodeURIComponent(currentCustomer.id)}`)}>
                      Open test drives
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void router.push(`/communications?customer_id=${encodeURIComponent(currentCustomer.id)}`)}>
                      Open communications
                    </Button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-slate-900">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Timeline</h3>
                        <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">{summary.timeline.length}</Badge>
                      </div>
                      <div className="space-y-3">
                        {summary.timeline.map((item: any) => {
                          const iconConfig = {
                            communication: { icon: MessageSquare, className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300' },
                            test_drive: { icon: CalendarClock, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
                            default: { icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
                          };
                          const tile = iconConfig[item.type as keyof typeof iconConfig] || iconConfig.default;
                          const IconTile = tile.icon;

                          return (
                            <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                              <div className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full ${tile.className}`}>
                                <IconTile className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 dark:border-amber-900/50 dark:from-amber-950/20 dark:to-slate-900">
                        <h3 className="font-semibold text-foreground">Recent test drives</h3>
                        <div className="mt-3 space-y-2">
                          {summary.testDrives.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No test drives recorded</p>
                          ) : (
                            summary.testDrives.slice(0, 5).map((testDrive: any) => (
                              <button
                                key={testDrive.id}
                                type="button"
                                onClick={() => void router.push(`/test-drives?customer_id=${encodeURIComponent(currentCustomer.id)}&status=${encodeURIComponent(testDrive.status || 'all')}`)}
                                className="w-full rounded-xl border border-amber-200/80 bg-white/80 p-3 text-left text-sm shadow-sm transition hover:border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900/80 dark:hover:border-amber-700 dark:hover:bg-slate-900"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-foreground">{testDrive.status || 'scheduled'}</span>
                                  <Badge variant="secondary" className="capitalize bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">{testDrive.status || 'scheduled'}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">{testDrive.scheduled_date || '—'} • {testDrive.scheduled_time || '—'}</p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4 dark:border-cyan-900/50 dark:from-cyan-950/20 dark:to-slate-900">
                        <h3 className="font-semibold text-foreground">Recent communications</h3>
                        <div className="mt-3 space-y-2">
                          {summary.communications.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No communications recorded</p>
                          ) : (
                            summary.communications.slice(0, 5).map((communication: any) => (
                              <button
                                key={communication.id}
                                type="button"
                                onClick={() => void router.push(`/communications?customer_id=${encodeURIComponent(currentCustomer.id)}`)}
                                className="w-full rounded-xl border border-cyan-200/80 bg-white/80 p-3 text-left text-sm shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 dark:border-cyan-800 dark:bg-slate-900/80 dark:hover:border-cyan-700 dark:hover:bg-slate-900"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-foreground capitalize">{communication.type || 'message'}</span>
                                  <Badge variant="secondary" className="capitalize bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-200">{communication.status || 'sent'}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">{communication.purpose || 'communication'} • {communication.sent_to || 'customer'}</p>
                              </button>
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
    </DashboardLayout>
  );
};

export default CustomersPage;
