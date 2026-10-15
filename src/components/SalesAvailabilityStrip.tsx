import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, UserRound } from 'lucide-react';

type Availability = 'available' | 'busy' | 'on_leave';

const STATUS_META: Record<Availability, { label: string; dot: string; badge: string; ring: string }> = {
  available: {
    label: 'Available',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/50',
  },
  busy: {
    label: 'Busy',
    dot: 'bg-red-500',
    badge: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    ring: 'ring-red-500/50',
  },
  on_leave: {
    label: 'On leave',
    dot: 'bg-amber-500',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/50',
  },
};

const BUSY_STATUSES = ['show', 'in_progress', 'key_handover_to_sales'];

const getInitials = (name?: string | null) =>
  (name || '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

const SalesAvailabilityStrip = () => {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [busyProfileIds, setBusyProfileIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const locationId = profile?.location_id || null;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const profiles = await apiGet<any[]>('/api/profiles');
      const userIds = (profiles || []).map((p) => p.user_id).filter(Boolean);
      const roles = userIds.length > 0
        ? await apiGet<any[]>(`/api/user-roles?user_ids=${encodeURIComponent(userIds.join(','))}`)
        : [];

      const salesStaff = (profiles || [])
        .map((p) => ({ ...p, user_roles: (roles || []).filter((r) => r.user_id === p.user_id) }))
        .filter((p) => (p.user_roles || []).some((r: any) => r.role === APP_ROLE.SALES))
        .filter((p) => (locationId ? p.location_id === locationId : true));

      setStaff(salesStaff);

      if (locationId) {
        const today = new Date().toLocaleDateString('en-CA');
        const drives = await apiGet<any[]>(
          `/api/test-drives?location_id=${encodeURIComponent(locationId)}&scheduled_date=${today}&limit=500`,
        ).catch(() => []);
        const busy = new Set<string>();
        (drives || []).forEach((d: any) => {
          if (BUSY_STATUSES.includes(d?.status) && d?.assigned_sales_person_id) {
            busy.add(String(d.assigned_sales_person_id));
          }
        });
        setBusyProfileIds(busy);
      } else {
        setBusyProfileIds(new Set());
      }
    } catch {
      setStaff([]);
      setBusyProfileIds(new Set());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      staff.map((person) => {
        const availability: Availability = person.on_leave
          ? 'on_leave'
          : busyProfileIds.has(String(person.id))
            ? 'busy'
            : 'available';
        return { ...person, availability };
      }),
    [staff, busyProfileIds],
  );

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.availability] += 1;
        return acc;
      },
      { available: 0, busy: 0, on_leave: 0 } as Record<Availability, number>,
    );
  }, [rows]);

  return (
    <section className="rounded-3xl border border-border/60 bg-card shadow-card">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Sales team</p>
            <h2 className="text-lg font-heading font-bold text-foreground">Who is free right now</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading || refreshing} className="h-8 text-xs">
            {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>

        {/* Legend + counts */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {(Object.keys(STATUS_META) as Availability[]).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-medium text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[key].dot}`} />
              {STATUS_META[key].label}
              <span className="font-semibold text-foreground">{counts[key]}</span>
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sales team…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No sales persons found for this location.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {rows.map((person) => {
              const meta = STATUS_META[person.availability as Availability];
              return (
                <div
                  key={person.id}
                  className="flex min-w-[150px] snap-start flex-col items-center gap-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-center"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-2 ${meta.ring}`}>
                    {getInitials(person.full_name)}
                  </div>
                  <p className="w-full truncate text-sm font-semibold text-foreground" title={person.full_name || ''}>
                    {person.full_name || 'Sales person'}
                  </p>
                  <Badge variant="outline" className={`gap-1.5 text-[10px] ${meta.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default SalesAvailabilityStrip;
