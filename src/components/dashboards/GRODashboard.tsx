import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { ActivityInsightsMini } from '@/components/ActivityInsightsMini';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarCheck, Clock, TrendingUp, Monitor, ShieldAlert, Car, RefreshCw, AlertTriangle, CheckCircle2, LayoutList, LayoutGrid, Activity, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GROCalendarView from './GROCalendarView';
import BlockedSlotsManager from './BlockedSlotsManager';
import { TestDriveInsightGrid } from './TestDriveInsightGrid';
import { StaffActivityGrid } from './StaffActivityGrid';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';
import { navigateTo } from '@/lib/browserNavigation';
import { DashboardStatusSections } from './DashboardStatusSections';
import { buildServiceBookingStatusCounts, buildTestDriveStatusCounts } from '@/lib/dashboardMetrics';
import { getAvailableTimeSlots } from '@/lib/slotAvailability';

const GRODashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showInsights, setShowInsights] = useState(false);
  const [boardMode, setBoardMode] = useState<'guest-list' | 'operations'>('guest-list');
  const [stats, setStats] = useState({ today: 0, upcoming: 0, completed: 0, completionRate: 0 });
  const [serviceBookingCount, setServiceBookingCount] = useState(0);
  const [serviceBookingStatusCounts, setServiceBookingStatusCounts] = useState<Record<string, number>>({
    booked: 0,
    confirmed: 0,
    in_progress: 0,
    ready_for_delivery: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
  });
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ startTime: string; endTime: string; startMinutes: number; endMinutes: number }>>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [noShowConfirmId, setNoShowConfirmId] = useState<string | null>(null);
  const [driveView, setDriveView] = useState<'list' | 'grid'>('list');
  const [detailSheetDrive, setDetailSheetDrive] = useState<any>(null);
  const [selectedStatusBucket, setSelectedStatusBucket] = useState<'all' | 'scheduled' | 'confirmed' | 'show' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled'>('all');
  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const boardBuckets = useMemo(() => {
    const expected = testDrives.filter((drive) => ['scheduled', 'confirmed'].includes(drive.status));
    const here = testDrives.filter((drive) => ['show', 'in_progress'].includes(drive.status));
    const withSales = testDrives.filter((drive) => drive.assigned_sales_person_id || drive.assigned_sales_person?.full_name);
    const left = testDrives.filter((drive) => ['completed', 'no_show', 'cancelled', 'rescheduled'].includes(drive.status));

    return { expected, here, withSales, left };
  }, [testDrives]);

  const boardMetrics = useMemo(() => [
    { label: 'Today', value: stats.today, hint: 'scheduled visits', icon: CalendarCheck, accent: 'text-primary', bg: 'bg-primary/10', action: () => setSelectedStatusBucket('scheduled') },
    { label: 'Active', value: stats.upcoming, hint: 'still in motion', icon: Clock, accent: 'text-info', bg: 'bg-info/10', action: () => setSelectedStatusBucket('confirmed') },
    { label: 'Completed', value: stats.completed, hint: `${stats.completionRate}% completion`, icon: CheckCircle2, accent: 'text-success', bg: 'bg-success/10', action: () => setSelectedStatusBucket('completed') },
    { label: 'Bookings', value: serviceBookingCount, hint: 'service handovers', icon: BookOpen, accent: 'text-accent-foreground', bg: 'bg-accent/10', action: () => navigateTo('/service-bookings') },
  ], [serviceBookingCount, stats.completed, stats.completionRate, stats.today, stats.upcoming]);

  const visibleDrives = selectedStatusBucket === 'all'
    ? testDrives
    : testDrives.filter((drive) => drive.status === selectedStatusBucket);

  useEffect(() => {
    fetchTestDrives();
  }, [profile]);

  // Real-time: auto-refresh + toast when any test drive status changes
  useTestDriveRealtime(profile?.location_id, (event) => {
    const [testDriveId] = Object.keys(event);
    const eventData = event[testDriveId];
    const statusLabel = eventData.status.replace(/_/g, ' ');
     toast({
      title: 'Test Drive Updated',
      description: `Test Drive Id : - ${testDriveId} is now "${statusLabel}"`,
    });
    fetchTestDrives();
  });

  const fetchTestDrives = async () => {
    if (!profile?.location_id) return;
    const drives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: profile.location_id }],
      order: [{ field: 'scheduled_date', ascending: true }],
    });

    const customerIds = Array.from(new Set((drives || []).map((d) => d.customer_id).filter(Boolean)));
    const vehicleIds = Array.from(new Set((drives || []).map((d) => d.vehicle_id).filter(Boolean)));
    const locationIds = Array.from(new Set((drives || []).map((d) => d.location_id).filter(Boolean)));

    const [customers, vehicles, locations] = await Promise.all([
      customerIds.length ? apiDbQuery<any[]>({ table: 'customers', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: customerIds }] }) : Promise.resolve([]),
      vehicleIds.length ? apiDbQuery<any[]>({ table: 'vehicles', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: vehicleIds }] }) : Promise.resolve([]),
      locationIds.length ? apiDbQuery<any[]>({ table: 'locations', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: locationIds }] }) : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    const enriched = (drives || []).map((d) => ({
      ...d,
      customers: customerMap.get(d.customer_id) || null,
      vehicles: vehicleMap.get(d.vehicle_id) || null,
      locations: locationMap.get(d.location_id) || null,
    }));

    setTestDrives(enriched);
    const today = new Date().toISOString().split('T')[0];
    const completedCount = enriched.filter(t => t.status === 'completed').length;
    setStats({
      today: enriched.filter(t => t.scheduled_date === today).length,
      upcoming: enriched.filter(t => t.status === 'scheduled' || t.status === 'confirmed').length,
      completed: completedCount,
      completionRate: enriched.length > 0 ? Math.round((completedCount / enriched.length) * 100) : 0,
    });

    const serviceBookings = await apiGet<any[]>(`/api/service-bookings?location_id=${encodeURIComponent(profile.location_id)}`).catch(() => [] as any[]);
    const counts = buildServiceBookingStatusCounts(serviceBookings || []);
    setServiceBookingCount(serviceBookings?.length || 0);
    setServiceBookingStatusCounts(counts);

    const vehicleRows = await apiGet<any[]>(`/api/vehicles?location_id=${encodeURIComponent(profile.location_id)}`).catch(() => [] as any[]);
    setTotalVehicles((vehicleRows || []).length);
  };

  const updateStatus = async (id: string, status: string) => {
    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: { status },
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    fetchTestDrives();
  };

  useEffect(() => {
    if (!rescheduleId || !newDate) {
      setRescheduleSlots([]);
      setNewTime('');
      return;
    }

    const original = testDrives.find((t) => t.id === rescheduleId);
    const locationId = original?.location_id;
    const slotDuration = Number(original?.slot_duration_minutes || original?.locations?.slot_duration_minutes || 30);

    if (!locationId || newDate < format(new Date(), 'yyyy-MM-dd')) {
      setRescheduleSlots([]);
      setNewTime('');
      return;
    }

    let cancelled = false;
    setRescheduleLoading(true);

    void getAvailableTimeSlots(locationId, newDate, slotDuration)
      .then(({ slots, error }) => {
        if (cancelled) return;
        if (error || !slots?.length) {
          setRescheduleSlots([]);
          setNewTime('');
          return;
        }

        setRescheduleSlots(slots);
        if (!newTime || !slots.some((slot) => slot.startTime === newTime)) {
          setNewTime(slots[0].startTime);
        }
      })
      .finally(() => {
        if (!cancelled) setRescheduleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rescheduleId, newDate, testDrives]);

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newTime) return;
    const original = testDrives.find((t) => t.id === rescheduleId);
    if (!original) return;

    if (newDate < format(new Date(), 'yyyy-MM-dd')) {
      toast({ title: 'Past date not allowed', description: 'Please choose a future date for the reschedule.', variant: 'destructive' });
      return;
    }

    const locationId = original.location_id;
    const slotDuration = Number(original.slot_duration_minutes || original.locations?.slot_duration_minutes || 30);
    const { slots, error } = await getAvailableTimeSlots(locationId, newDate, slotDuration);

    if (error || !slots?.length || !slots.some((slot) => slot.startTime === newTime)) {
      toast({ title: 'Slot unavailable', description: 'Please choose one of the available time slots for this date.', variant: 'destructive' });
      return;
    }

    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: { scheduled_date: newDate, scheduled_time: `${newTime}:00`, status: 'rescheduled' },
      filters: [{ field: 'id', op: 'eq', value: rescheduleId }],
    });
    setRescheduleId(null);
    setNewDate('');
    setNewTime('');
    setRescheduleSlots([]);
    fetchTestDrives();
  };

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info',
    confirmed: 'bg-primary/10 text-primary',
    show: 'bg-success/10 text-success',
    no_show: 'bg-warning/10 text-warning',
    in_progress: 'bg-accent/10 text-accent-foreground',
    completed: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const waitingBoardUrl = profile?.location_id
    ? `/waiting-board?location=${profile.location_id}`
    : '/waiting-board';

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-card">
        <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[1.25fr_0.95fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Monitor className="h-3.5 w-3.5" />
                GRO live board
              </div>
              <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                {profile?.location_id ? `Location ${profile.location_id}` : 'All showroom activity'}
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-heading font-bold text-foreground sm:text-4xl">In the showroom</h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Dynamic guest tracking, test-drive flow, and handover control in one board that matches the showroom rhythm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant={boardMode === 'guest-list' ? 'default' : 'outline'} className={boardMode === 'guest-list' ? 'rounded-full bg-foreground text-background hover:bg-foreground/90' : 'rounded-full'} onClick={() => setBoardMode('guest-list')}>
                Guest list
              </Button>
              <Button variant={boardMode === 'operations' ? 'default' : 'outline'} className={boardMode === 'operations' ? 'rounded-full bg-foreground text-background hover:bg-foreground/90' : 'rounded-full'} onClick={() => setBoardMode('operations')}>
                Operations
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => setShowInsights((prev) => !prev)}>
                {showInsights ? 'Hide insights' : 'Show insights'}
              </Button>
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => window.open(waitingBoardUrl, '_blank')}>
                <Monitor className="mr-2 h-4 w-4" /> Waiting board
              </Button>
            </div>

            {showInsights && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {boardMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <button
                      key={metric.label}
                      type="button"
                      onClick={metric.action}
                      className="group rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${metric.bg}`}>
                          <Icon className={`h-5 w-5 ${metric.accent}`} />
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Live</span>
                      </div>
                      <div className="mt-4 text-2xl font-heading font-bold text-foreground">{metric.value}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{metric.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{metric.hint}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Board focus</p>
                <p className="text-xs text-muted-foreground">Switch the live board view without losing the action flow.</p>
              </div>
              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {formatStatusLabel(selectedStatusBucket === 'all' ? 'all' : selectedStatusBucket)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Expected', value: boardBuckets.expected.length, tone: 'bg-sky-100 text-sky-700 border-sky-200' },
                { label: 'Here', value: boardBuckets.here.length, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                { label: 'With sales', value: boardBuckets.withSales.length, tone: 'bg-violet-100 text-violet-700 border-violet-200' },
                { label: 'Left', value: boardBuckets.left.length, tone: 'bg-amber-100 text-amber-700 border-amber-200' },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-3 ${item.tone}`}>
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-80">{item.label}</div>
                  <div className="mt-2 text-2xl font-heading font-bold">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">Quick status</div>
                <Button variant="ghost" className="h-8 px-2 text-xs text-primary" onClick={() => setSelectedStatusBucket('all')}>
                  Clear filter
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['all', 'scheduled', 'confirmed', 'show', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled'] as const).map((status) => {
                  const active = selectedStatusBucket === status;
                  const count = status === 'all' ? testDrives.length : testDrives.filter((drive) => drive.status === status).length;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatusBucket(status)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'}`}
                    >
                      {status === 'all' ? 'All' : formatStatusLabel(status)} · {count}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="shadow-card border-border/60">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-heading font-bold text-foreground">Showroom board</h2>
                <p className="text-sm text-muted-foreground">A live sequence of guests, handovers, and next moves.</p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
                <Button size="sm" variant={driveView === 'list' ? 'secondary' : 'ghost'} className="h-8 rounded-full px-3 text-xs" onClick={() => setDriveView('list')}>
                  <LayoutList className="mr-1 h-3.5 w-3.5" /> List
                </Button>
                <Button size="sm" variant={driveView === 'grid' ? 'secondary' : 'ghost'} className="h-8 rounded-full px-3 text-xs" onClick={() => setDriveView('grid')}>
                  <LayoutGrid className="mr-1 h-3.5 w-3.5" /> Grid
                </Button>
              </div>
            </div>

            {driveView === 'grid' ? (
              <TestDriveInsightGrid testDrives={visibleDrives} title="Showroom board grouped view" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                {[
                  { title: 'Expected', items: boardBuckets.expected, tone: 'border-sky-200 bg-sky-50/60', empty: 'No expected arrivals yet.' },
                  { title: 'Here', items: boardBuckets.here, tone: 'border-emerald-200 bg-emerald-50/60', empty: 'No guests currently in the showroom.' },
                  { title: 'With sales executive', items: boardBuckets.withSales, tone: 'border-violet-200 bg-violet-50/60', empty: 'No assigned guests in this lane.' },
                  { title: 'Left', items: boardBuckets.left, tone: 'border-amber-200 bg-amber-50/60', empty: 'No closed items in this lane.' },
                ].map((column) => (
                  <div key={column.title} className={`rounded-3xl border p-3 sm:p-4 ${column.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{column.title}</div>
                        <div className="mt-1 text-2xl font-heading font-bold text-foreground">{column.items.length}</div>
                      </div>
                      <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => navigateTo('/test-drives')}>
                        View all
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {column.items.slice(0, 4).map((td) => (
                        <button
                          key={td.id}
                          type="button"
                          onClick={() => setDetailSheetDrive(td)}
                          className="w-full rounded-2xl border border-border/60 bg-card/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground">{td.customers?.full_name}</div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {td.vehicles?.brand} {td.vehicles?.model}
                              </div>
                            </div>
                            <Badge variant="secondary" className={`shrink-0 text-[11px] ${statusColor[td.status] || ''}`}>
                              {formatStatusLabel(td.status)}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>{td.scheduled_time ? td.scheduled_time.substring(0, 5) : 'No time'}</span>
                            <span>{td.assigned_sales_person?.full_name || 'Unassigned'}</span>
                          </div>
                        </button>
                      ))}
                      {column.items.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                          {column.empty}
                        </div>
                      )}
                      {column.items.length > 4 && (
                        <Button variant="outline" className="w-full rounded-full" onClick={() => navigateTo('/test-drives')}>
                          Show {column.items.length - 4} more
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-card border-border/60">
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-heading font-bold text-foreground">Action lane</h2>
                  <p className="text-sm text-muted-foreground">Fast access to the work you actually need today.</p>
                </div>
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" className="h-auto flex-col items-start justify-start rounded-2xl p-4 text-left" onClick={() => navigateTo('/walkin')}>
                  <span className="text-sm font-semibold">Walk-in desk</span>
                  <span className="text-xs font-normal text-muted-foreground">Open new guests and assign the right next step.</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col items-start justify-start rounded-2xl p-4 text-left" onClick={() => navigateTo('/test-drives')}>
                  <span className="text-sm font-semibold">All test drives</span>
                  <span className="text-xs font-normal text-muted-foreground">Track bookings, statuses, and current work.</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col items-start justify-start rounded-2xl p-4 text-left" onClick={() => navigateTo('/service-bookings')}>
                  <span className="text-sm font-semibold">Service bookings</span>
                  <span className="text-xs font-normal text-muted-foreground">Keep handovers and service flow visible.</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col items-start justify-start rounded-2xl p-4 text-left" onClick={() => navigateTo('/vehicles')}>
                  <span className="text-sm font-semibold">Vehicle inventory</span>
                  <span className="text-xs font-normal text-muted-foreground">Open the showroom stock behind every booking.</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/60">
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-heading font-bold text-foreground">Status shortcuts</h2>
                  <p className="text-sm text-muted-foreground">Jump straight into a status lane.</p>
                </div>
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['scheduled', 'confirmed', 'show', 'in_progress', 'completed', 'no_show', 'rescheduled', 'cancelled'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setSelectedStatusBucket(status);
                      navigateTo(`/test-drives?status=${encodeURIComponent(status)}`);
                    }}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <span className="text-sm font-medium text-foreground">{formatStatusLabel(status)}</span>
                    <span className="text-xs text-muted-foreground">{testDrives.filter((drive) => drive.status === status).length}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Tabs defaultValue="calendar" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
          <TabsList className="order-2 grid w-full grid-cols-4 rounded-md border bg-muted p-1 sm:order-none sm:w-auto sm:flex">
            <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendar</TabsTrigger>
            <TabsTrigger value="test-drives" className="text-xs sm:text-sm">Test Drives</TabsTrigger>
            <TabsTrigger value="staff-activity" className="text-xs sm:text-sm">
              <Activity className="mr-1 h-3.5 w-3.5" /> Staff
            </TabsTrigger>
            <TabsTrigger value="blocked" className="text-xs sm:text-sm">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Blocked
            </TabsTrigger>
          </TabsList>
          <div className="order-1 flex w-full gap-2 sm:order-none sm:w-auto">
            <Button variant="outline" className="w-full rounded-full sm:w-auto" onClick={() => setShowInsights((prev) => !prev)}>
              {showInsights ? 'Hide insights' : 'Show insights'}
            </Button>
            <Button className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={() => window.open(waitingBoardUrl, '_blank')}>
              <Monitor className="mr-2 h-4 w-4" /> Waiting board
            </Button>
          </div>
        </div>

        <TabsContent value="calendar" className="space-y-4">
          {showInsights && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Today's Drives", value: stats.today, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
                { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
                { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: CheckCircle2, color: 'text-accent-foreground', bg: 'bg-accent/10' },
                { label: 'Service Bookings', value: serviceBookingCount, icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Total Vehicles', value: totalVehicles, icon: Car, color: 'text-sky-600', bg: 'bg-sky-100' },
              ].map(stat => {
                const Icon = stat.icon;
                const handleCardClick = () => {
                  if (stat.label === 'Service Bookings') {
                    navigateTo('/service-bookings');
                    return;
                  }
                  if (stat.label === 'Total Vehicles') {
                    navigateTo('/vehicles');
                    return;
                  }
                  if (stat.label === "Today's Drives" || stat.label === 'Upcoming') {
                    navigateTo('/test-drives?status=scheduled');
                  } else if (stat.label === 'Completed') {
                    navigateTo('/test-drives?status=completed');
                  } else {
                    navigateTo('/test-drives');
                  }
                };
                return (
                  <Card key={stat.label} className="shadow-card h-full min-w-0 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md" onClick={handleCardClick}>
                    <CardContent className="flex min-h-[88px] items-center gap-2.5 p-3 sm:min-h-[96px] sm:gap-3 sm:p-4">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stat.bg} sm:h-10 sm:w-10`}>
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-lg font-bold leading-none text-foreground sm:text-xl">{stat.value}</p>
                        <p className="mt-1 break-words text-[11px] leading-tight text-muted-foreground sm:text-xs">{stat.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <GROCalendarView />
        </TabsContent>

        <TabsContent value="test-drives" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">All Test Drives <span className="text-muted-foreground">({testDrives.length})</span></p>
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
              <Button size="sm" variant={driveView === 'list' ? 'secondary' : 'ghost'} className="h-7 rounded-full px-2.5 text-xs" onClick={() => setDriveView('list')}>
                <LayoutList className="mr-1 h-3.5 w-3.5" /> List
              </Button>
              <Button size="sm" variant={driveView === 'grid' ? 'secondary' : 'ghost'} className="h-7 rounded-full px-2.5 text-xs" onClick={() => setDriveView('grid')}>
                <LayoutGrid className="mr-1 h-3.5 w-3.5" /> Grid
              </Button>
            </div>
          </div>
          {driveView === 'grid' ? (
            <TestDriveInsightGrid testDrives={testDrives} title="Test drives grouped view" />
          ) : (
            <Card className="shadow-card">
              <CardContent className="pt-4 sm:pt-6">
                <div className="space-y-3">
                  {testDrives.map(td => (
                    <div key={td.id} className="cursor-pointer rounded-lg border border-border p-3 transition-colors hover:bg-muted/30 sm:p-4" onClick={() => setDetailSheetDrive(td)}>
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{td.customers?.full_name}</p>
                            <Badge variant="secondary" className={`text-xs ${statusColor[td.status] || ''}`}>{formatStatusLabel(td.status)}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{td.source}</Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Car className="h-3 w-3" />
                            <span>{td.vehicles?.brand} {td.vehicles?.model}</span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{td.scheduled_date} {(td.scheduled_time || '').substring(0, 5)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                          {td.status === 'scheduled' && (
                            <>
                              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => updateStatus(td.id, 'confirmed')}>Confirm</Button>
                              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                            </>
                          )}
                          {td.status === 'confirmed' && (
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                          )}
                          {td.status === 'in_progress' && (
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'completed')}>Complete</Button>
                          )}
                          {['scheduled', 'confirmed', 'show', 'no_show'].includes(td.status) && (
                            <Button size="sm" variant="outline" className="border-info/50 text-info hover:bg-info/10 text-xs gap-1" onClick={() => { setRescheduleId(td.id); setNewDate(''); setNewTime(''); }}>
                              <RefreshCw className="h-3 w-3" /> Reschedule
                            </Button>
                          )}
                          {['scheduled', 'confirmed', 'show'].includes(td.status) && (
                            <Button size="sm" variant="outline" className="border-warning/50 text-warning hover:bg-warning/10 text-xs gap-1" onClick={() => setNoShowConfirmId(td.id)}>
                              <AlertTriangle className="h-3 w-3" /> No Show
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {testDrives.length > 5 && (
                    <div className="flex justify-center pt-2">
                      <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigateTo('/test-drives')}>
                        View All {testDrives.length} Test Drives →
                      </Button>
                    </div>
                  )}
                  {testDrives.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">No test drives scheduled</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="staff-activity">
          <StaffActivityGrid />
        </TabsContent>

        <TabsContent value="blocked">
          <BlockedSlotsManager />
        </TabsContent>
      </Tabs>

      <TestDriveDetailSheet
        testDrive={detailSheetDrive}
        open={!!detailSheetDrive}
        onClose={() => setDetailSheetDrive(null)}
      />

      <Dialog open={!!rescheduleId} onOpenChange={(open) => {
        if (!open) {
          setRescheduleId(null);
          setNewDate('');
          setNewTime('');
          setRescheduleSlots([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reschedule Test Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Input
                type="date"
                value={newDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setNewTime('');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Available time slots</Label>
              {rescheduleLoading ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                  Loading available slots...
                </div>
              ) : rescheduleSlots.length > 0 ? (
                <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {rescheduleSlots.map((slot) => (
                    <Button key={slot.startTime} type="button" variant={newTime === slot.startTime ? 'default' : 'outline'} className="h-9 justify-center text-xs" onClick={() => setNewTime(slot.startTime)}>
                      {slot.startTime}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                  No available slots for this date. Please choose a different date.
                </div>
              )}
            </div>
            <Button onClick={handleReschedule} disabled={!newDate || !newTime || rescheduleLoading || rescheduleSlots.length === 0} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Confirm Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noShowConfirmId} onOpenChange={(o) => !o && setNoShowConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Mark as No Show?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const td = testDrives.find(t => t.id === noShowConfirmId);
              return td
                ? `Are you sure you want to mark ${td.customers?.full_name || 'this customer'}'s test drive as no-show?`
                : 'Are you sure you want to mark this test drive as no-show?';
            })()}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setNoShowConfirmId(null)}>
              Cancel
            </Button>
            <Button className="rounded-xl bg-warning text-warning-foreground hover:bg-warning/90" onClick={() => { updateStatus(noShowConfirmId!, 'no_show'); setNoShowConfirmId(null); }}>
              Yes, Mark No Show
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GRODashboard;
