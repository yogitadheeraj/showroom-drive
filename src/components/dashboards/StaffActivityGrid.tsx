import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Activity, Calendar, Users, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { apiDbQuery } from '@/lib/apiClient';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';

type GroupBy    = 'date' | 'staff';
type WindowType = 'today' | 'week' | 'month';

const EVENT_LABELS: Record<string, string> = {
  test_drive_started:     'Drive Started',
  test_drive_completed:   'Drive Completed',
  test_drive_rescheduled: 'Rescheduled',
  test_drive_check_in:    'Check-in',
  test_drive_check_out:   'Check-out',
  key_handover:           'Key Handover',
  login:                  'Login',
  logout:                 'Logout',
  page_view:              'Page View',
};

const EVENT_COLORS: Record<string, string> = {
  test_drive_started:     'bg-info/10 text-info border-info/20',
  test_drive_completed:   'bg-success/10 text-success border-success/20',
  test_drive_rescheduled: 'bg-warning/10 text-warning border-warning/20',
  test_drive_check_in:    'bg-primary/10 text-primary border-primary/20',
  test_drive_check_out:   'bg-muted text-muted-foreground border-border',
  key_handover:           'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  login:                  'bg-success/10 text-success border-success/20',
  logout:                 'bg-muted text-muted-foreground border-border',
};

export function StaffActivityGrid() {
  const { profile, role }                              = useAuth();
  const { dealerLocationIds, loading: dealerLoading }  = useDealerContext();

  const [groupBy,    setGroupBy]    = useState<GroupBy>('date');
  const [window_,    setWindow_]    = useState<WindowType>('today');
  const [events,     setEvents]     = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading,    setLoading]    = useState(true);
  const [collapsed,  setCollapsed]  = useState<Set<string>>(new Set());

  const isStaffOnly = ([APP_ROLE.SALES, APP_ROLE.SECURITY] as string[]).includes(role ?? '');

  useEffect(() => {
    if (!dealerLoading) void fetchData();
  }, [dealerLoading, dealerLocationIds, window_]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now   = new Date();
      const since = new Date(now);
      if      (window_ === 'today') since.setHours(0, 0, 0, 0);
      else if (window_ === 'week')  since.setDate(since.getDate() - 7);
      else                          since.setDate(since.getDate() - 30);

      const locationFilters: any[] = dealerLocationIds?.length
        ? [{ field: 'location_id', op: 'in', value: dealerLocationIds }]
        : [];

      const profileFilter: any[] = isStaffOnly && profile?.id
        ? [{ field: 'profile_id', op: 'eq', value: profile.id }]
        : [];

      const [eventsRows, profiles] = await Promise.all([
        apiDbQuery<any[]>({
          table:   'staff_activity_events',
          action:  'select',
          select:  '*',
          filters: [...locationFilters, ...profileFilter,
                    { field: 'happened_at', op: 'gte', value: since.toISOString() }] as any[],
          order:   [{ field: 'happened_at', ascending: false }],
          limit:   500,
        }),
        dealerLocationIds?.length
          ? apiDbQuery<any[]>({
              table:   'profiles',
              action:  'select',
              select:  'id, full_name',
              filters: [{ field: 'location_id', op: 'in', value: dealerLocationIds }] as any[],
              limit:   200,
            })
          : Promise.resolve([] as any[]),
      ]);

      const map: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { if (p.id) map[p.id] = p.full_name || 'Unknown'; });
      setProfileMap(map);
      setEvents(eventsRows || []);
    } finally {
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    events.forEach(ev => {
      const key = groupBy === 'date'
        ? (ev.happened_at ? ev.happened_at.substring(0, 10) : 'Unknown Date')
        : (profileMap[ev.profile_id] ?? ev.profile_id ?? 'Unknown Staff');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    const entries = Array.from(map.entries());
    // dates: newest first; staff: alphabetical
    entries.sort(([a], [b]) => groupBy === 'date' ? b.localeCompare(a) : a.localeCompare(b));
    return entries;
  }, [events, groupBy, profileMap]);

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const today = new Date().toISOString().split('T')[0];

  return (
    <Card className="shadow-card border-primary/20 relative overflow-hidden">
      {/* Gradient accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-info to-success" />

      <CardHeader className="pb-3 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="font-heading text-base flex items-center gap-2 flex-wrap">
            <Activity className="h-4 w-4 text-primary" />
            Staff Activity Grid
            {/* Live pulse */}
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success/10 border border-success/20 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
            <Badge variant="secondary" className="text-xs font-normal">{events.length} events</Badge>
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group by</span>

            <Select value={groupBy} onValueChange={(v: GroupBy) => { setGroupBy(v); setCollapsed(new Set()); }}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">📅 Date</SelectItem>
                <SelectItem value="staff">👤 Staff</SelectItem>
              </SelectContent>
            </Select>

            <Select value={window_} onValueChange={(v: WindowType) => setWindow_(v)}>
              <SelectTrigger className="w-[125px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void fetchData()}>
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">Loading activity…</div>
        ) : groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No activity found for the selected period.</div>
        ) : (
          groups.map(([groupKey, groupEvents]) => {
            const isToday     = groupBy === 'date' && groupKey === today;
            const isCollapsed = collapsed.has(groupKey);
            const tdCount     = groupEvents.filter(e => (e.event_type ?? '').startsWith('test_drive')).length;

            return (
              <div
                key={groupKey}
                className={`rounded-xl border overflow-hidden ${groupBy === 'date' ? 'border-primary/20 bg-primary/5' : 'border-info/20 bg-info/5'}`}
              >
                {/* Group header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.03] transition-colors"
                  onClick={() => toggleCollapse(groupKey)}
                >
                  <div className="flex items-center gap-2 flex-wrap text-left">
                    {groupBy === 'date'
                      ? <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                      : <Users    className="h-3.5 w-3.5 text-info shrink-0" />}

                    <span className="font-semibold text-sm text-foreground">
                      {groupBy === 'date'
                        ? new Date(`${groupKey}T00:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                          })
                        : groupKey}
                    </span>

                    {isToday && (
                      <span className="text-[10px] bg-primary text-white rounded-full px-1.5 py-0.5 font-bold">Today</span>
                    )}
                    <Badge variant="secondary" className="text-[10px] font-normal">{groupEvents.length} events</Badge>
                    {tdCount > 0 && (
                      <span className="text-[10px] text-primary font-semibold">{tdCount} TD events</span>
                    )}
                  </div>
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>

                {/* Event cards */}
                {!isCollapsed && (
                  <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {groupEvents.map(ev => {
                      const staffName  = profileMap[ev.profile_id] ?? ev.profile_id ?? 'Unknown';
                      const colorClass = EVENT_COLORS[ev.event_type] ?? 'bg-muted text-muted-foreground border-border';
                      const label      = EVENT_LABELS[ev.event_type] ?? ev.event_label ?? ev.event_type ?? 'Event';

                      return (
                        <div
                          key={ev.id}
                          className="bg-background rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-150 p-3 space-y-1.5"
                        >
                          {/* Event type + time */}
                          <div className="flex items-start justify-between gap-1.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
                              {label}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {ev.happened_at
                                ? new Date(ev.happened_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </span>
                          </div>

                          {/* Staff (shown when grouped by date) */}
                          {groupBy === 'date' && (
                            <p className="text-xs font-medium text-foreground truncate">👤 {staffName}</p>
                          )}

                          {/* Role badge */}
                          {ev.role && (
                            <p className="text-[10px] text-muted-foreground capitalize">{ev.role}</p>
                          )}

                          {/* Route */}
                          {ev.route && (
                            <p className="text-[10px] text-muted-foreground truncate">📍 {ev.route}</p>
                          )}

                          {/* Additional label if different from type label */}
                          {ev.event_label && ev.event_label !== label && (
                            <p className="text-[10px] text-muted-foreground truncate">{ev.event_label}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
