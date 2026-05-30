import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiDbQuery } from '@/lib/apiClient';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { Car, Activity, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_ROLE } from '@/constants/roles';

const TD_EVENT_TYPES = [
  'test_drive_started', 'test_drive_completed', 'test_drive_rescheduled',
  'test_drive_check_in', 'test_drive_check_out', 'key_handover','license_uploaded', 'license_verified', 'license_rejected', 'vehicle_inspection_pre', 'vehicle_inspection_post',
];

interface Counts {
  tdEvents: number;
  staffEvents: number;
  openTasks: number;
  activeSessions: number;
}

const GROUPS = [
  { key: 'tdEvents' as const, label: 'TD Events Today', icon: Car, color: 'text-info', bg: 'bg-info/10' },
  { key: 'staffEvents' as const, label: 'Staff Events Today', icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'openTasks' as const, label: 'Open Follow-ups', icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
  { key: 'activeSessions' as const, label: 'Active Sessions', icon: Users, color: 'text-success', bg: 'bg-success/10' },
];

export function ActivityInsightsMini() {
  const { role, profile } = useAuth();
  const { dealerLocationIds, loading: dealerLoading } = useDealerContext();
  const [counts, setCounts] = useState<Counts>({ tdEvents: 0, staffEvents: 0, openTasks: 0, activeSessions: 0 });
  const [loading, setLoading] = useState(true);

  const isStaffOnly = ([APP_ROLE.SALES, APP_ROLE.SECURITY] as string[]).includes(role ?? '');

  useEffect(() => {
    if (!dealerLoading) void fetchCounts();
  }, [dealerLoading, dealerLocationIds]);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const today = new Date().setHours(0, 0, 0, 0);
      const todayISO = new Date(today).toISOString();

      const locationFilters: Array<{ field: string; op: 'in' | 'eq'; value: any }> =
        dealerLocationIds?.length ? [{ field: 'location_id', op: 'in', value: dealerLocationIds }] : [];

      // For staff-only roles, scope events to their own profile
      const profileFilter: Array<{ field: string; op: 'eq'; value: any }> =
        isStaffOnly && profile?.id ? [{ field: 'profile_id', op: 'eq', value: profile.id }] : [];

      const [eventsRows, taskRows, sessionRows] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'staff_activity_events',
          action: 'select',
          select: 'id, event_type',
          filters: [...locationFilters, ...profileFilter, { field: 'happened_at', op: 'gte', value: todayISO }] as any[],
          limit: 500,
        }),
        apiDbQuery<any[]>({
          table: 'sales_tasks',
          action: 'select',
          select: 'id',
          filters: isStaffOnly && profile?.id
            ? [{ field: 'status', op: 'eq', value: 'open' }, { field: 'assigned_to_profile_id', op: 'eq', value: profile.id }] as any[]
            : [{ field: 'status', op: 'eq', value: 'open' }] as any[],
          limit: 200,
        }),
        apiDbQuery<any[]>({
          table: 'staff_activity_sessions',
          action: 'select',
          select: 'id',
          filters: [...locationFilters, { field: 'is_online', op: 'eq', value: true }] as any[],
          limit: 100,
        }),
      ]);

      const events = eventsRows || [];
      console.log('Fetched events:', events);
      setCounts({
        tdEvents: events.filter(e => TD_EVENT_TYPES.includes(e.event_type)).length,
        staffEvents: events.length,
        openTasks: (taskRows || []).length,
        activeSessions: (sessionRows || []).length,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" /> Activity Insights
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void fetchCounts()}>
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {GROUPS.map(g => {
            const Icon = g.icon;
            return (
              <div key={g.key} className={`flex items-center gap-2.5 p-3 rounded-xl ${g.bg}`}>
                <Icon className={`h-5 w-5 ${g.color} shrink-0`} />
                <div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{g.label}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">
                    {loading ? '—' : counts[g.key]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
