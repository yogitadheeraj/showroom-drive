import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDbQuery, apiGet, apiPatch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { APP_ROLE } from '@/constants/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import WalkinDialog from '@/components/WalkinDialog';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';
import CarConfiguratorExperience from '@/components/public/CarConfiguratorExperience';
import Customer360Sheet from '@/components/dashboards/Customer360Sheet';
import { navigateTo } from '@/lib/browserNavigation';
import { getTestDriveStatus } from '@/lib/testDriveStatus';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import {
  AlertTriangle,
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Plus,
  Sparkles,
  Sun,
  UserRound,
  Zap,
} from 'lucide-react';

/* ── Tab switcher (Today default / Overview = classic dashboard) ── */

export const TodayOverviewSwitch = ({
  view,
  onChange,
}: {
  view: 'today' | 'overview';
  onChange: (view: 'today' | 'overview') => void;
}) => {
  const tabs = [
    { key: 'today' as const, label: 'Today', icon: Sun },
    { key: 'overview' as const, label: 'Overview', icon: CalendarCheck },
  ];
  return (
    <div className="flex w-fit items-center gap-1 rounded-2xl border border-border/80 bg-muted/50 p-1.5 shadow-inner">
      {tabs.map((tab) => {
        const active = view === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.key)}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition ${
              active
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md ring-1 ring-sky-400/40'
                : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

/* ── Status styling ── */

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  key_assigned: { label: 'Key Assigned', dot: 'bg-amber-500', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  scheduled: { label: 'Scheduled', dot: 'bg-slate-400', badge: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300' },
  rescheduled: { label: 'Rescheduled', dot: 'bg-slate-400', badge: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300' },
  confirmed: { label: 'Confirmed', dot: 'bg-blue-500', badge: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  show: { label: 'Arrived', dot: 'bg-violet-500', badge: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  in_progress: { label: 'On drive', dot: 'bg-sky-500', badge: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  key_handover_to_sales: { label: 'Key handover', dot: 'bg-amber-500', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  completed: { label: 'Completed', dot: 'bg-emerald-500', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  no_show: { label: 'No show', dot: 'bg-red-500', badge: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' },
  cancelled: { label: 'Cancelled', dot: 'bg-muted-foreground', badge: 'border-border bg-muted text-muted-foreground' },
};

const LIVE_STATUSES = ['show', 'key_assigned', 'in_progress', 'key_handover_to_sales'];
const UPCOMING_STATUSES = ['scheduled', 'confirmed', 'rescheduled'];

const timeToMinutes = (value?: string | null) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatTime = (value?: string | null) => {
  const mins = timeToMinutes(value);
  if (mins === null) return value || '—';
  const h24 = Math.floor(mins / 60);
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins % 60).padStart(2, '0')} ${suffix}`;
};

const greetingForHour = (hour: number) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const toISODate = (d: Date) => d.toLocaleDateString('en-CA');

const startOfWeek = (base: Date) => {
  const d = new Date(base);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getRangeForTab = (tab: 'day' | 'week' | 'month') => {
  const nowD = new Date();
  if (tab === 'day') {
    const iso = toISODate(nowD);
    return { gte: iso, lte: iso };
  }
  if (tab === 'week') {
    const start = startOfWeek(nowD);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { gte: toISODate(start), lte: toISODate(end) };
  }
  const first = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const last = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0);
  return { gte: toISODate(first), lte: toISODate(last) };
};

const addMinutesLabel = (mins: number) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
};

/* ── Today view ── */

const TodayView = () => {
  const { profile, role } = useAuth();
  const { toast } = useToast();
  const [drives, setDrives] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calTab, setCalTab] = useState<'day' | 'week' | 'month'>('day');
  const [bucketFilter, setBucketFilter] = useState<'all' | 'arrived' | 'live' | 'upcoming' | 'completed' | 'no_show'>('all');
  const [detailDrive, setDetailDrive] = useState<any | null>(null);
  const [customer360Id, setCustomer360Id] = useState<string | null>(null);
  const [configuratorOpen, setConfiguratorOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockVehicles, setStockVehicles] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<{ date?: string; time?: string } | null>(null);
  const [dayListDate, setDayListDate] = useState<string | null>(null);
  const [tdActionSaving, setTdActionSaving] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = getRangeForTab(calTab);
      const params = new URLSearchParams({ limit: '400', include_related: 'true' });
      if (calTab === 'day') {
        params.set('scheduled_date', range.gte);
      } else {
        params.set('date_gte', range.gte);
        params.set('date_lte', range.lte);
      }
      if (role === APP_ROLE.SALES && profile?.id) {
        params.set('sales_person_id', profile.id);
      } else if (profile?.location_id) {
        params.set('location_id', profile.location_id);
      }
      const rows = await apiGet<any[]>(`/api/test-drives?${params.toString()}`).catch(() => []);

      let tasks: any[] = [];
      if (profile?.id) {
        tasks = await apiDbQuery<any[]>({
          table: 'sales_tasks',
          action: 'select',
          select: '*',
          filters: [
            { field: 'assigned_to_profile_id', op: 'eq', value: profile.id },
            { field: 'status', op: 'eq', value: 'open' },
          ],
        }).catch(() => []);
      }

      const sorted = (rows || [])
        .map((drive) => ({ ...drive, status: getTestDriveStatus(drive) }))
        .slice()
        .sort((a, b) => String(a?.scheduled_time || '').localeCompare(String(b?.scheduled_time || '')));
      setDrives(sorted);
      setDetailDrive((current) => current ? sorted.find((drive) => drive.id === current.id) || current : null);
      setFollowUps(
        (tasks || []).filter((t: any) => String(t?.due_at || '').startsWith(todayStr)),
      );
    } finally {
      setLoading(false);
    }
  }, [calTab, role, profile?.id, profile?.location_id, todayStr]);

  useEffect(() => {
    load();
  }, [load]);
  useTestDriveRealtime(profile?.location_id, () => { void load(); });

  const updateTdStatus = async (id: string, status: string) => {
    setTdActionSaving(true);
    try {
      await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { status });
      setDetailDrive((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
      toast({ title: 'Test drive updated', description: `Status changed to ${status.replace(/_/g, ' ')}.` });
      await load();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message || 'Could not update test drive', variant: 'destructive' });
    } finally {
      setTdActionSaving(false);
    }
  };

  const renderTdActions = (td: any) => {
    if (role === APP_ROLE.SALES) {
      return (
        <div className="flex flex-wrap gap-2">
          {['scheduled', 'confirmed', 'rescheduled', 'show'].includes(td.status) && !td.key_handed_at && (
            td.customers?.driving_license_verified ? (
              <Button size="sm" disabled={tdActionSaving} onClick={async () => {
                setTdActionSaving(true);
                try {
                  const keyHandedAt = new Date().toISOString();
                  await apiPatch(`/api/test-drives/${encodeURIComponent(td.id)}`, { key_handed_at: keyHandedAt, status: 'key_assigned' });
                  setDetailDrive((current) => current?.id === td.id ? { ...current, key_handed_at: keyHandedAt, status: 'key_assigned' } : current);
                  toast({ title: 'Key assigned', description: 'Security will start the drive at the gate.' });
                  await load();
                } catch (error) {
                  toast({ title: 'Key assignment failed', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
                } finally { setTdActionSaving(false); }
              }}>Assign Key</Button>
            ) : <p className="text-xs text-warning">Upload the driving license below and have Security verify it before assigning the key.</p>
          )}
          {td.status === 'key_handover_to_sales' && (
            <Button size="sm" onClick={() => navigateTo('/test-drives')}>Key Handover &amp; Follow-up</Button>
          )}
          {td.status === 'key_assigned' && <p className="text-xs text-muted-foreground">Key Assigned - awaiting Security inspection and start.</p>}
          <Button size="sm" variant="outline" onClick={() => navigateTo('/test-drives')}>All Test Drive Actions</Button>
        </div>
      );
    }
    const buttons: Array<{ label: string; next: string; variant?: 'default' | 'outline' | 'destructive' }> = [];
    if (['scheduled', 'rescheduled'].includes(td.status)) {
      buttons.push(
        { label: 'Confirm booking', next: 'confirmed' },
        { label: 'Mark no-show', next: 'no_show', variant: 'outline' },
        { label: 'Cancel', next: 'cancelled', variant: 'destructive' },
      );
    } else if (td.status === 'confirmed') {
      buttons.push(
        { label: 'Mark arrived', next: 'show' },
        { label: 'Mark no-show', next: 'no_show', variant: 'outline' },
        { label: 'Cancel', next: 'cancelled', variant: 'destructive' },
      );
    } else if (['show', 'key_assigned'].includes(td.status)) {
      return <p className="text-xs text-muted-foreground">Sales assigns the key; Security completes inspection and starts the drive.</p>;
    } else if (td.status === 'in_progress') {
      buttons.push(
        { label: 'Complete drive', next: 'completed' },
        { label: 'Key handover to sales', next: 'key_handover_to_sales', variant: 'outline' },
      );
    } else if (td.status === 'key_handover_to_sales') {
      buttons.push({ label: 'Complete drive', next: 'completed' });
    }
    if (buttons.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <Button
            key={b.next}
            size="sm"
            variant={b.variant || 'default'}
            disabled={tdActionSaving}
            onClick={() => updateTdStatus(td.id, b.next)}
          >
            {b.label}
          </Button>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (!stockOpen) return;
    setStockLoading(true);
    const params = new URLSearchParams({ is_active: 'true' });
    if (profile?.location_id) params.set('location_id', profile.location_id);
    apiGet<any[]>(`/api/vehicles?${params.toString()}`)
      .then((rows) => setStockVehicles(rows || []))
      .catch(() => setStockVehicles([]))
      .finally(() => setStockLoading(false));
  }, [stockOpen, profile?.location_id]);

  const todayDrives = useMemo(
    () => drives.filter((d) => String(d?.scheduled_date || '').startsWith(todayStr)),
    [drives, todayStr],
  );

  const stats = useMemo(() => {
    const total = todayDrives.length;
    const done = todayDrives.filter((d) => d.status === 'completed').length;
    const live = todayDrives.filter((d) => LIVE_STATUSES.includes(d.status)).length;
    const upcoming = todayDrives.filter((d) => UPCOMING_STATUSES.includes(d.status)).length;
    const noShow = todayDrives.filter((d) => d.status === 'no_show').length;
    return { total, done, live, upcoming, noShow };
  }, [todayDrives]);

  const arrivedToday = useMemo(() => todayDrives.filter((d) => d.status === 'show'), [todayDrives]);

  const overdueToday = useMemo(
    () =>
      todayDrives.filter((d) => {
        const mins = timeToMinutes(d.scheduled_time);
        return UPCOMING_STATUSES.includes(d.status) && mins !== null && mins < nowMinutes;
      }),
    [todayDrives, nowMinutes],
  );

  const bucketFiltered = useMemo(() => {
    switch (bucketFilter) {
      case 'arrived': return arrivedToday;
      case 'live': return todayDrives.filter((d) => LIVE_STATUSES.includes(d.status));
      case 'upcoming': return todayDrives.filter((d) => UPCOMING_STATUSES.includes(d.status));
      case 'completed': return todayDrives.filter((d) => d.status === 'completed');
      case 'no_show': return todayDrives.filter((d) => d.status === 'no_show');
      default: return todayDrives;
    }
  }, [todayDrives, arrivedToday, bucketFilter]);

  const drivesByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    drives.forEach((d) => {
      const key = String(d?.scheduled_date || '').slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [drives]);

  const dayHours = useMemo(() => {
    const hours = todayDrives
      .map((d) => timeToMinutes(d.scheduled_time))
      .filter((m): m is number => m !== null)
      .map((m) => Math.floor(m / 60));
    const min = Math.min(9, ...(hours.length > 0 ? hours : [9]));
    const max = Math.max(18, ...(hours.length > 0 ? hours : [18]));
    const arr: number[] = [];
    for (let h = min; h <= max; h += 1) arr.push(h);
    return arr;
  }, [todayDrives]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const monthCells = useMemo(() => {
    const nowD = new Date();
    const first = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(nowD.getFullYear(), nowD.getMonth(), d));
    return cells;
  }, []);

  const buckets: Array<{ key: typeof bucketFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'arrived', label: 'Arrived', count: arrivedToday.length },
    { key: 'live', label: 'On drive', count: stats.live },
    { key: 'upcoming', label: 'Upcoming', count: stats.upcoming },
    { key: 'completed', label: 'Completed', count: stats.done },
    { key: 'no_show', label: 'No show', count: stats.noShow },
  ];

  const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const customerOf = (td: any) => td?.customers?.full_name || td?.customer_name || 'Customer';
  const vehicleOf = (td: any) =>
    td?.vehicles?.name || td?.vehicle_name || [td?.vehicles?.make, td?.vehicles?.model].filter(Boolean).join(' ') || 'Vehicle';

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/60 bg-card py-16 text-sm text-muted-foreground shadow-card">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your day…
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-sky-500/15 via-primary/10 to-violet-500/10 p-5 shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sun className="h-3.5 w-3.5" /> Today
            </p>
            <h2 className="text-xl font-heading font-bold text-foreground sm:text-2xl">
              {greetingForHour(now.getHours())}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-sm text-muted-foreground">
              {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Day progress</span>
              <span className="font-semibold text-foreground">{stats.done} of {stats.total} completed</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-[11px] font-semibold text-primary">{progress}%</p>
          </div>
        </div>
      </section>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Today's drives", value: stats.total, icon: CalendarCheck, accent: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
          { label: 'Live now', value: stats.live, icon: Zap, accent: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400' },
          { label: 'Upcoming', value: stats.upcoming, icon: Clock, accent: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400' },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className={`rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm ${tile.accent}`}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{tile.label}</p>
                <Icon className="h-4 w-4 opacity-80" />
              </div>
              <p className="mt-2 text-2xl font-heading font-bold text-foreground">{tile.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Calendar (left) + Highlights & leads (right) ── */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Left: My calendar */}
        <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-card sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-heading font-semibold text-foreground">
              <CalendarCheck className="h-4 w-4 text-primary" /> My calendar
            </h3>
            <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-muted/50 p-1">
              {(['day', 'week', 'month'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={calTab === tab}
                  onClick={() => setCalTab(tab)}
                  className={`h-7 rounded-lg px-3 text-[11px] font-semibold capitalize transition ${
                    calTab === tab
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {calTab === 'day' && (
            todayDrives.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Sparkles className="h-8 w-8 text-primary/60" />
                <p className="text-sm font-medium text-foreground">No events today</p>
                <p className="text-xs text-muted-foreground">New bookings for today will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {dayHours.map((hour) => {
                  const blocks = todayDrives.filter((d) => {
                    const mins = timeToMinutes(d.scheduled_time);
                    return mins !== null && Math.floor(mins / 60) === hour;
                  });
                  return (
                    <div key={hour} className="flex gap-3">
                      <span className="w-14 shrink-0 pt-2 text-right text-[10px] font-medium text-muted-foreground">
                        {formatTime(`${hour}:00`)}
                      </span>
                      <div
                        className={`min-h-[44px] flex-1 space-y-1.5 border-t border-border/50 py-1.5 ${blocks.length === 0 ? 'cursor-pointer transition hover:bg-muted/20' : ''}`}
                        onClick={() => {
                          if (blocks.length === 0) {
                            setBookingDraft({ date: todayStr, time: `${String(hour).padStart(2, '0')}:00` });
                          }
                        }}
                        title={blocks.length === 0 ? 'Click to create a booking at this time' : undefined}
                      >
                        {blocks.map((td) => {
                          const meta = STATUS_META[td.status] || STATUS_META.scheduled;
                          return (
                            <button
                              key={td.id}
                              type="button"
                              onClick={() => setDetailDrive(td)}
                              className="w-full rounded-lg border border-border/60 border-l-4 bg-muted/20 px-2.5 py-1.5 text-left transition hover:bg-muted/40"
                              style={{ borderLeftColor: 'hsl(var(--primary))' }}
                            >
                              <p className="truncate text-xs font-semibold text-foreground">
                                {formatTime(td.scheduled_time)} · {customerOf(td)}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {vehicleOf(td)} · {meta.label}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {calTab === 'week' && (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const iso = toISODate(day);
                const dayDrives = drivesByDate[iso] || [];
                const isToday = iso === todayStr;
                return (
                  <div
                    key={iso}
                    onClick={() => {
                      const dayDrives = drivesByDate[iso] || [];
                      if (dayDrives.length > 0) setDayListDate(iso);
                      else setBookingDraft({ date: iso });
                    }}
                    title="View bookings or create one on this date"
                    className={`min-h-[120px] cursor-pointer rounded-xl border p-1.5 transition hover:border-primary/40 ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/10'}`}
                  >
                    <p className={`text-center text-[10px] font-semibold uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p className={`text-center text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</p>
                    <div className="mt-1.5 space-y-1">
                      {dayDrives.slice(0, 3).map((td) => (
                        <div key={td.id} className="truncate rounded-md border border-border/50 bg-card px-1 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
                          {formatTime(td.scheduled_time)} {customerOf(td)}
                        </div>
                      ))}
                      {dayDrives.length > 3 && (
                        <p className="text-center text-[9px] text-muted-foreground">+{dayDrives.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calTab === 'month' && (
            <div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {monthCells.map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} />;
                  const iso = toISODate(cell);
                  const count = (drivesByDate[iso] || []).length;
                  const isToday = iso === todayStr;
                  return (
                    <div
                      key={iso}
                      onClick={() => {
                        const dayDrives = drivesByDate[iso] || [];
                        if (dayDrives.length > 0) setDayListDate(iso);
                        else setBookingDraft({ date: iso });
                      }}
                      title="View bookings or create one on this date"
                      className={`flex h-12 cursor-pointer flex-col items-center justify-center rounded-lg border text-xs transition hover:border-primary/40 ${
                        isToday ? 'border-primary/60 bg-primary/10 font-bold text-primary' : 'border-border/40 bg-muted/10 text-foreground'
                      }`}
                    >
                      <span>{cell.getDate()}</span>
                      {count > 0 && (
                        <span className="mt-0.5 rounded-full bg-primary/15 px-1.5 text-[9px] font-semibold text-primary">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end border-t border-border/50 pt-3">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigateTo('/walkin')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New event
            </Button>
          </div>
        </section>

        {/* Right: highlights + leads & activities */}
        <div className="space-y-4">
          <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-card sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-heading font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Highlights
              <span className="text-xs font-normal text-muted-foreground">{arrivedToday.length + overdueToday.length} open</span>
            </h3>
            {arrivedToday.length === 0 && overdueToday.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing needs attention right now.</p>
            ) : (
              <div className="space-y-2">
                {arrivedToday.map((td) => (
                  <div key={td.id} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                    <p className="text-xs text-foreground">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Arrived {formatTime(td.scheduled_time)}</span>
                      {' '}· {customerOf(td)} is in the showroom
                    </p>
                    <Button size="sm" variant="outline" className="h-7 shrink-0 text-[10px]" onClick={() => td.customer_id && setCustomer360Id(td.customer_id)}>
                      Open
                    </Button>
                  </div>
                ))}
                {overdueToday.map((td) => {
                  const over = nowMinutes - (timeToMinutes(td.scheduled_time) ?? nowMinutes);
                  return (
                    <div key={td.id} className="flex items-center justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2">
                      <p className="text-xs text-foreground">
                        <span className="font-semibold text-red-600 dark:text-red-400">SLA breach</span>
                        {' '}· {customerOf(td)} · {addMinutesLabel(over)} over
                      </p>
                      <Button size="sm" variant="outline" className="h-7 shrink-0 text-[10px]" onClick={() => setDetailDrive(td)}>
                        Action
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-card sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-heading font-semibold text-foreground">
                <Zap className="h-4 w-4 text-primary" /> My leads & activities
              </h3>
              <button type="button" onClick={() => navigateTo('/test-drives')} className="text-xs font-medium text-primary hover:underline">
                Open full view →
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {buckets.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBucketFilter(b.key)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    bucketFilter === b.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {b.count} {b.label}
                </button>
              ))}
            </div>

            {bucketFiltered.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No items in this bucket.</p>
            ) : (
              <div className="space-y-2">
                {bucketFiltered.slice(0, 8).map((td) => {
                  const meta = STATUS_META[td.status] || STATUS_META.scheduled;
                  const mins = timeToMinutes(td.scheduled_time);
                  const dueIn = mins !== null ? mins - nowMinutes : null;
                  return (
                    <div key={td.id} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
                            <Car className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{customerOf(td)}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {vehicleOf(td)} · {formatTime(td.scheduled_time)}
                            </p>
                          </div>
                        </div>
                        {dueIn !== null && dueIn >= 0 && dueIn <= 60 && UPCOMING_STATUSES.includes(td.status) && (
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Due in {dueIn} min
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Button size="sm" className="h-7 rounded-lg px-2.5 text-[10px]" onClick={() => td.customer_id && setCustomer360Id(td.customer_id)}>
                          Open customer
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-[10px]" onClick={() => setDetailDrive(td)}>
                          Test drive
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-[10px]" onClick={() => setStockOpen(true)}>
                          Stock
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-[10px]" onClick={() => setConfiguratorOpen(true)}>
                          Configure
                        </Button>
                        <Badge variant="outline" className={`ml-auto gap-1 text-[10px] ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-3 border-t border-border/60 pt-3">
                        {renderTdActions(td)}
                      </div>
                    </div>
                  );
                })}
                {bucketFiltered.length > 8 && (
                  <p className="pt-1 text-center text-[11px] text-muted-foreground">+ {bucketFiltered.length - 8} more in full view</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Follow-ups due today ── */}
      <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-card sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-heading font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-amber-500" /> Follow-ups due today
            <span className="text-xs font-normal text-muted-foreground">({followUps.length})</span>
          </h3>
          <button type="button" onClick={() => navigateTo('/follow-ups')} className="text-xs font-medium text-primary hover:underline">
            All follow-ups →
          </button>
        </div>
        {followUps.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">Nothing due today — you're all caught up.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {followUps.slice(0, 6).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title || 'Follow-up'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {task.due_at ? formatTime(String(task.due_at).slice(11, 16)) : ''}{task.priority ? ` · ${task.priority}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                  Due today
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Canvas overlays ── */}
      <TestDriveDetailSheet
        testDrive={detailDrive}
        open={!!detailDrive}
        onClose={() => setDetailDrive(null)}
        actions={detailDrive ? renderTdActions(detailDrive) : null}
        onChanged={() => void load()}
      />

      <Customer360Sheet customerId={customer360Id} open={!!customer360Id} onClose={() => setCustomer360Id(null)} />

      <Dialog open={configuratorOpen} onOpenChange={(o) => !o && setConfiguratorOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-0">
          <div className="p-4 sm:p-6">
            <CarConfiguratorExperience />
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={stockOpen} onOpenChange={(o) => !o && setStockOpen(false)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="font-heading">Stock</SheetTitle>
          </SheetHeader>
          {stockLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading stock…
            </div>
          ) : stockVehicles.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No vehicles in stock.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {stockVehicles.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {[v.brand, v.model, v.variant].filter(Boolean).join(' ') || v.name || 'Vehicle'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {[v.year, v.fuel_type || v.engine_type, v.transmission].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={v.is_available !== false
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border bg-muted text-muted-foreground'}
                  >
                    {v.is_available !== false ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Date TD list popup ── */}
      <Dialog open={!!dayListDate} onOpenChange={(o) => !o && setDayListDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Test drives · {dayListDate
                ? new Date(`${dayListDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(drivesByDate[dayListDate || ''] || []).map((td) => {
              const meta = STATUS_META[td.status] || STATUS_META.scheduled;
              return (
                <button
                  key={td.id}
                  type="button"
                  onClick={() => {
                    setDetailDrive(td);
                    setDayListDate(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-left transition hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {formatTime(td.scheduled_time)} · {customerOf(td)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{vehicleOf(td)}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] ${meta.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </Badge>
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
              setBookingDraft({ date: dayListDate || undefined });
              setDayListDate(null);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New booking on this date
          </Button>
        </DialogContent>
      </Dialog>

      <WalkinDialog
        open={!!bookingDraft}
        onClose={(submitted) => {
          setBookingDraft(null);
          if (submitted) load();
        }}
        defaultDate={bookingDraft?.date}
        defaultTime={bookingDraft?.time}
      />
    </div>
  );
};

export default TodayView;
