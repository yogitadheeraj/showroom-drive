import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, Calendar, Users, Tag, ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';

type GroupBy = 'date' | 'staff' | 'source';

const STATUS_STYLES: Record<string, string> = {
  scheduled:              'bg-info/10 text-info border-info/20',
  confirmed:              'bg-primary/10 text-primary border-primary/20',
  show:                   'bg-success/10 text-success border-success/20',
  no_show:                'bg-warning/10 text-warning border-warning/20',
  in_progress:            'bg-purple-100 text-purple-700 border-purple-200',
  key_handover_to_sales:  'bg-warning/10 text-warning border-warning/20',
  completed:              'bg-success/10 text-success border-success/20',
  cancelled:              'bg-destructive/10 text-destructive border-destructive/20',
  rescheduled:            'bg-muted text-muted-foreground border-border',
};

const SOURCE_LABELS: Record<string, string> = {
  walkin:   'Walk-in',
  online:   'Online',
  booking:  'Booking',
  referral: 'Referral',
  whatsapp: 'WhatsApp',
};

const GROUP_HEADER: Record<GroupBy, string> = {
  date:   'border-info/30 bg-info/5',
  staff:  'border-primary/30 bg-primary/5',
  source: 'border-success/30 bg-success/5',
};

const formatStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Resolves the best available staff name from any enriched test drive shape:
 *  - SuperAdmin API: assigned_sales_person / assigned_gro
 *  - BranchAdmin Supabase: profiles / gro_profile
 *  - GRODashboard apiDbQuery: no nested profiles (shows Unassigned)
 */
const getStaffName = (td: any): string =>
  td.assigned_sales_person?.full_name ??
  td.assigned_gro?.full_name ??
  td.profiles?.full_name ??
  td.gro_profile?.full_name ??
  'Unassigned';

interface Props {
  testDrives: any[];
  loading?: boolean;
  title?: string;
  defaultGroupBy?: GroupBy;
}

export function TestDriveInsightGrid({
  testDrives,
  loading = false,
  title = 'Test Drive Grid',
  defaultGroupBy = 'date',
}: Props) {
  const [groupBy, setGroupBy]           = useState<GroupBy>(defaultGroupBy);
  const [statusFilter, setStatusFilter] = useState('all');
  const [collapsed, setCollapsed]       = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];

  const filtered = useMemo(
    () => statusFilter === 'all' ? testDrives : testDrives.filter(td => td.status === statusFilter),
    [testDrives, statusFilter],
  );

  const getGroupKey = (td: any): string => {
    if (groupBy === 'date')   return td.scheduled_date || 'No Date';
    if (groupBy === 'staff')  return getStaffName(td);
    return SOURCE_LABELS[td.source] || td.source || 'Unknown';
  };

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach(td => {
      const key = getGroupKey(td);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(td);
    });
    const entries = Array.from(map.entries());
    // dates: chronological; others: alphabetical
    entries.sort(([a], [b]) =>
      groupBy === 'date' ? a.localeCompare(b) : a.localeCompare(b)
    );
    return entries;
  }, [filtered, groupBy]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    testDrives.forEach(td => { c[td.status] = (c[td.status] ?? 0) + 1; });
    return c;
  }, [testDrives]);

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <Card className="shadow-card border-info/20 relative overflow-hidden">
      {/* Gradient accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-info via-primary to-success" />

      <CardHeader className="pb-3 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="font-heading text-base flex items-center gap-2 flex-wrap">
            <LayoutGrid className="h-4 w-4 text-info" />
            {title}
            <Badge variant="secondary" className="text-xs font-normal">{filtered.length} drives</Badge>
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group by</span>

            <Select value={groupBy} onValueChange={(v: GroupBy) => { setGroupBy(v); setCollapsed(new Set()); }}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">📅 Date</SelectItem>
                <SelectItem value="staff">👤 Staff</SelectItem>
                <SelectItem value="source">📡 Source</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {['scheduled','confirmed','show','in_progress','key_handover_to_sales','completed','no_show','cancelled','rescheduled'].map(s => (
                  <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clickable status summary chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Object.entries(statusCounts).sort(([,a],[,b]) => b - a).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(prev => prev === status ? 'all' : status)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-opacity ${STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'} ${statusFilter !== 'all' && statusFilter !== status ? 'opacity-35' : ''}`}
            >
              {formatStatus(status)} · {count}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">Loading drives…</div>
        ) : groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No test drives match the current filter.</div>
        ) : (
          groups.map(([groupKey, drives]) => {
            const isToday      = groupBy === 'date' && groupKey === today;
            const isCollapsed  = collapsed.has(groupKey);
            const doneCount    = drives.filter(d => d.status === 'completed').length;
            const activeCount  = drives.filter(d => ['scheduled','confirmed','show','in_progress'].includes(d.status)).length;

            return (
              <div key={groupKey} className={`rounded-xl border ${GROUP_HEADER[groupBy]} overflow-hidden`}>
                {/* Group header — click to collapse */}
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.03] transition-colors"
                  onClick={() => toggleCollapse(groupKey)}
                >
                  <div className="flex items-center gap-2 flex-wrap text-left">
                    {groupBy === 'date'   && <Calendar className="h-3.5 w-3.5 text-info shrink-0" />}
                    {groupBy === 'staff'  && <Users    className="h-3.5 w-3.5 text-primary shrink-0" />}
                    {groupBy === 'source' && <Tag      className="h-3.5 w-3.5 text-success shrink-0" />}

                    <span className="font-semibold text-sm text-foreground">
                      {groupBy === 'date'
                        ? new Date(`${groupKey}T00:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                          })
                        : groupKey}
                    </span>

                    {isToday && (
                      <span className="text-[10px] bg-info text-white rounded-full px-1.5 py-0.5 font-bold">Today</span>
                    )}
                    <Badge variant="secondary" className="text-[10px] font-normal">{drives.length}</Badge>
                    {doneCount   > 0 && <span className="text-[10px] text-success font-semibold">{doneCount} done</span>}
                    {activeCount > 0 && <span className="text-[10px] text-info font-semibold">{activeCount} active</span>}
                  </div>
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>

                {/* Drive cards grid */}
                {!isCollapsed && (
                  <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {drives.map(td => (
                      <div
                        key={td.id}
                        className="bg-background rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-150 p-3 space-y-2"
                      >
                        {/* Customer + status */}
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="font-semibold text-sm text-foreground leading-tight line-clamp-1 flex-1">
                            {td.customers?.full_name || td.customer_name || '—'}
                          </p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[td.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                            {formatStatus(td.status)}
                          </span>
                        </div>

                        {/* Vehicle */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Car className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {[td.vehicles?.brand, td.vehicles?.model].filter(Boolean).join(' ') || td.vehicle_name || '—'}
                          </span>
                        </div>

                        {/* Date/time + source */}
                        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>{td.scheduled_date} {(td.scheduled_time || '').substring(0, 5)}</span>
                          <span className="font-medium capitalize px-1.5 py-0.5 rounded bg-muted/60">
                            {SOURCE_LABELS[td.source] ?? td.source ?? '—'}
                          </span>
                        </div>

                        {/* Staff name — hidden when grouped by staff */}
                        {groupBy !== 'staff' && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            👤 {getStaffName(td)}
                          </p>
                        )}
                      </div>
                    ))}
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
