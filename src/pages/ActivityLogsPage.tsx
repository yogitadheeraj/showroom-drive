import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { apiDbQuery } from '@/lib/apiClient';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import {
  Activity, Shield, Car, TrendingUp, Clock, Users, Search,
  CalendarCheck, CheckCircle2, AlertTriangle, RefreshCw, LogIn, LogOut, UserCircle2,
  ScrollText,
} from 'lucide-react';
import { APP_ROLE, APP_ROLE_LABELS } from '@/constants/roles';

// ── helpers ─────────────────────────────────────────────────
const fmtDt = (v?: string | null) =>
  v ? new Date(v).toLocaleString() : '—';

const fmtDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const ROLE_COLOR: Record<string, string> = {
  superadmin: 'bg-destructive/10 text-destructive',
  dealer_admin: 'bg-secondary/10 text-secondary-foreground',
  sales_admin: 'bg-purple-100 text-purple-700',
  gro: 'bg-primary/10 text-primary',
  sales: 'bg-info/10 text-info',
  security: 'bg-warning/10 text-warning',
};

const TD_EVENT_TYPES = [
  'test_drive_started', 'test_drive_completed', 'test_drive_rescheduled',
  'test_drive_check_in', 'test_drive_check_out',
  'vehicle_inspection_pre', 'vehicle_inspection_post',
  'key_handover', 'car_booking_created', 'license_verified',
];

const FOLLOWUP_EVENT_TYPES = [
  'opportunity_created', 'task_created', 'lead_marked_hot', 'lead_marked_cold',
  'follow_up_note', 'opportunity_stage_changed',
];

// ── Insight KPI bar ──────────────────────────────────────────
interface KPI { label: string; value: number; icon: any; color: string; bg: string }

function KpiRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {kpis.map(k => {
        const Icon = k.icon;
        return (
          <Card key={k.label} className="shadow-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                <p className="text-2xl font-bold font-heading text-foreground">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────
function Empty({ label }: { label: string }) {
  return <p className="text-center text-muted-foreground py-12 text-sm">{label}</p>;
}

// ── Activity row ─────────────────────────────────────────────
function ActivityRow({ event, profileMap }: { event: any; profileMap: Map<string, string> }) {
  const staffName = profileMap.get(event.profile_id) || 'Unknown Staff';
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">{event.event_label || event.event_type}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staffName}
            {event.role && (
              <Badge className={`ml-1.5 text-[10px] px-1.5 py-0 ${ROLE_COLOR[event.role] || 'bg-muted text-muted-foreground'}`}>
                {APP_ROLE_LABELS[event.role as keyof typeof APP_ROLE_LABELS] || event.role}
              </Badge>
            )}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtDt(event.happened_at)}</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
const ActivityLogsPage = () => {
  const { role, profile } = useAuth();
  const { dealerLocationIds, loading: dealerLoading } = useDealerContext();

  // data
  const [staffEvents, setStaffEvents] = useState<any[]>([]);
  const [tdEvents, setTdEvents] = useState<any[]>([]);
  const [followUpTasks, setFollowUpTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // filters
  const [dateWindow, setDateWindow] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!dealerLoading) void fetchAll();
  }, [dealerLocationIds, dealerLoading, dateWindow]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const locationFilters: Array<{ field: string; op: 'in' | 'eq'; value: any }> =
        dealerLocationIds?.length
          ? [{ field: 'location_id', op: 'in', value: dealerLocationIds }]
          : [];

      const cutoff = dateWindow === 'today'
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : dateWindow === '7d'
        ? new Date(Date.now() - 7 * 86400_000).toISOString()
        : dateWindow === '30d'
        ? new Date(Date.now() - 30 * 86400_000).toISOString()
        : null;

      const dateFilter: Array<{ field: string; op: 'gte'; value: string }> = cutoff
        ? [{ field: 'happened_at', op: 'gte', value: cutoff }]
        : [];

      const [allEvents, taskRows, sessionRows] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'staff_activity_events',
          action: 'select',
          select: 'id, event_type, event_label, happened_at, role, profile_id, location_id, metadata',
          filters: [...locationFilters, ...dateFilter] as any[],
          order: [{ field: 'happened_at', ascending: false }],
          limit: 500,
        }),
        apiDbQuery<any[]>({
          table: 'sales_tasks',
          action: 'select',
          select: 'id, title, status, priority, due_at, created_at, customer_id, assigned_to_profile_id, opportunity_id, test_drive_id',
          filters: dealerLocationIds?.length
            ? [] // sales_tasks has no location_id — fetch all for this owner
            : [],
          order: [{ field: 'created_at', ascending: false }],
          limit: 200,
        }),
        apiDbQuery<any[]>({
          table: 'staff_activity_sessions',
          action: 'select',
          select: 'id, profile_id, role, login_at, logout_at, active_seconds, idle_seconds, is_online, location_id',
          filters: locationFilters as any[],
          order: [{ field: 'login_at', ascending: false }],
          limit: 200,
        }),
      ]);

      // Build profile map
      const allProfileIds = Array.from(new Set([
        ...(allEvents || []).map((e: any) => e.profile_id),
        ...(sessionRows || []).map((s: any) => s.profile_id),
        ...(taskRows || []).map((t: any) => t.assigned_to_profile_id),
      ].filter(Boolean)));

      const profileRows = allProfileIds.length
        ? await apiDbQuery<any[]>({
            table: 'profiles',
            action: 'select',
            select: 'id, full_name',
            filters: [{ field: 'id', op: 'in', value: allProfileIds }],
          })
        : [];

      const pMap = new Map((profileRows || []).map((p: any) => [p.id, p.full_name]));
      setProfileMap(pMap);

      const events = allEvents || [];
      setStaffEvents(events);
      setTdEvents(events.filter((e: any) => TD_EVENT_TYPES.includes(e.event_type)));
      setFollowUpTasks(taskRows || []);
      setSessions(sessionRows || []);
    } finally {
      setLoading(false);
    }
  };

  // ── My (current user) derived lists ──
  const myEvents = staffEvents.filter(e => e.profile_id === profile?.id);
  const myTasks = followUpTasks.filter(t => t.assigned_to_profile_id === profile?.id);
  const mySessions = sessions.filter(s => s.profile_id === profile?.id);

  const filteredMyEvents = myEvents.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const label = (e.event_label || e.event_type || '').toLowerCase();
      if (!label.includes(q)) return false;
    }
    return true;
  });

  // ── Derived / filtered lists ──
  const today = new Date().toISOString().split('T')[0];

  const filteredStaff = staffEvents.filter(e => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = profileMap.get(e.profile_id)?.toLowerCase() || '';
      const label = (e.event_label || e.event_type || '').toLowerCase();
      if (!name.includes(q) && !label.includes(q)) return false;
    }
    return true;
  });

  const filteredTd = tdEvents.filter(e => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = profileMap.get(e.profile_id)?.toLowerCase() || '';
      const label = (e.event_label || e.event_type || '').toLowerCase();
      if (!name.includes(q) && !label.includes(q)) return false;
    }
    return true;
  });

  const filteredFollowUps = followUpTasks.filter(t => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (t.title || '').toLowerCase();
      const name = profileMap.get(t.assigned_to_profile_id)?.toLowerCase() || '';
      if (!title.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  const filteredSessions = sessions.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = profileMap.get(s.profile_id)?.toLowerCase() || '';
      if (!name.includes(q)) return false;
    }
    return true;
  });

  // ── KPI insights ──
  const todayStaffEvents = staffEvents.filter(e => (e.happened_at || '').startsWith(today));
  const todayTdEvents = tdEvents.filter(e => (e.happened_at || '').startsWith(today));
  const onlineSessions = sessions.filter(s => s.is_online);
  const openTasks = followUpTasks.filter(t => t.status === 'open');

  const kpis: KPI[] = [
    { label: 'Staff Events Today', value: todayStaffEvents.length, icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Test Drive Events Today', value: todayTdEvents.length, icon: Car, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Open Follow-up Tasks', value: openTasks.length, icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Active Sessions Now', value: onlineSessions.length, icon: Users, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
          Activity Logs
          </h1>
            <p className="text-sm text-muted-foreground">Full audit trail across staff, test drives, and follow-ups</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Select value={dateWindow} onValueChange={(v: any) => setDateWindow(v)}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── KPI Insight Cards ── */}
        <KpiRow kpis={kpis} />

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, event…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px] h-8 text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(APP_ROLE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="mine">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="mine" className="text-xs sm:text-sm gap-1.5">
              <Shield className="h-3.5 w-3.5" /> My Activities
              <Badge className="ml-0.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{filteredMyEvents.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="staff" className="text-xs sm:text-sm gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Staff Activities
              <Badge className="ml-0.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{filteredStaff.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="testdrive" className="text-xs sm:text-sm gap-1.5">
              <Car className="h-3.5 w-3.5" /> Test Drive Activities
              <Badge className="ml-0.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{filteredTd.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="followup" className="text-xs sm:text-sm gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Follow-up Activities
              <Badge className="ml-0.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{filteredFollowUps.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs sm:text-sm gap-1.5">
              <Users className="h-3.5 w-3.5" /> User Sessions
              <Badge className="ml-0.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{filteredSessions.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── My Activities ── */}
          <TabsContent value="mine">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">My Activity History</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6">Loading…</p>
                ) : filteredMyEvents.length === 0 ? (
                  <Empty label="No activities recorded for your account in this period." />
                ) : (
                  <div className="max-h-[65vh] overflow-y-auto">
                    {filteredMyEvents.map(event => (
                      <ActivityRow key={event.id} event={event} profileMap={profileMap} />
                    ))}
                  </div>
                )}
                {(myTasks.length > 0 || mySessions.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-warning/10 text-center">
                      <p className="text-xs text-muted-foreground">My Open Tasks</p>
                      <p className="text-2xl font-bold text-warning">{myTasks.filter(t => t.status === 'open').length}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 text-center">
                      <p className="text-xs text-muted-foreground">My Total Events</p>
                      <p className="text-2xl font-bold text-primary">{myEvents.length}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-success/10 text-center">
                      <p className="text-xs text-muted-foreground">My Sessions</p>
                      <p className="text-2xl font-bold text-success">{mySessions.length}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Staff Activities ── */}
          <TabsContent value="staff">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">All Staff Activity Events</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6">Loading…</p>
                ) : filteredStaff.length === 0 ? (
                  <Empty label="No staff activities found for the selected period." />
                ) : (
                  <div className="max-h-[65vh] overflow-y-auto">
                    {filteredStaff.map(event => (
                      <ActivityRow key={event.id} event={event} profileMap={profileMap} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Test Drive Activities ── */}
          <TabsContent value="testdrive">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Test Drive Specific Events</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6">Loading…</p>
                ) : filteredTd.length === 0 ? (
                  <Empty label="No test drive events found." />
                ) : (
                  <div className="max-h-[65vh] overflow-y-auto">
                    {filteredTd.map(event => {
                      const meta = event.metadata || {};
                      return (
                        <div
                          key={event.id}
                          className="flex items-start justify-between gap-3 py-2.5 border-b border-border/60 last:border-0"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="h-7 w-7 rounded-full bg-info/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Car className="h-3.5 w-3.5 text-info" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">{event.event_label || event.event_type}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                  {profileMap.get(event.profile_id) || 'Unknown'}
                                </p>
                                {event.role && (
                                  <Badge className={`text-[10px] px-1.5 py-0 ${ROLE_COLOR[event.role] || 'bg-muted text-muted-foreground'}`}>
                                    {APP_ROLE_LABELS[event.role as keyof typeof APP_ROLE_LABELS] || event.role}
                                  </Badge>
                                )}
                                {meta.testDriveId && (
                                  <span className="text-[10px] text-muted-foreground">Drive #{(meta.testDriveId as string).slice(0, 8)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtDt(event.happened_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Follow-up Activities ── */}
          <TabsContent value="followup">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Follow-up Tasks &amp; Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6">Loading…</p>
                ) : filteredFollowUps.length === 0 ? (
                  <Empty label="No follow-up tasks found." />
                ) : (
                  <div className="max-h-[65vh] overflow-y-auto">
                    {filteredFollowUps.map(task => {
                      const isOpen = task.status === 'open';
                      const isOverdue = isOpen && task.due_at && new Date(task.due_at) < new Date();
                      return (
                        <div
                          key={task.id}
                          className="flex items-start justify-between gap-3 py-2.5 border-b border-border/60 last:border-0"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isOpen ? isOverdue ? 'bg-destructive/10' : 'bg-warning/10' : 'bg-success/10'}`}>
                              {isOpen ? (
                                <AlertTriangle className={`h-3.5 w-3.5 ${isOverdue ? 'text-destructive' : 'text-warning'}`} />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                  {profileMap.get(task.assigned_to_profile_id) || 'Unassigned'}
                                </p>
                                <Badge className={`text-[10px] px-1.5 py-0 ${isOpen ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                                  {task.status}
                                </Badge>
                                <Badge className={`text-[10px] px-1.5 py-0 ${task.priority === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                                  {task.priority}
                                </Badge>
                                {task.due_at && (
                                  <span className={`text-[10px] ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    Due: {new Date(task.due_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtDt(task.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── User Sessions ── */}
          <TabsContent value="sessions">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Staff Login Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6">Loading…</p>
                ) : filteredSessions.length === 0 ? (
                  <Empty label="No sessions found." />
                ) : (
                  <div className="max-h-[65vh] overflow-y-auto">
                    {filteredSessions.map(session => {
                      const name = profileMap.get(session.profile_id) || 'Unknown';
                      return (
                        <div
                          key={session.id}
                          className="flex items-start justify-between gap-3 py-2.5 border-b border-border/60 last:border-0"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${session.is_online ? 'bg-success/10' : 'bg-muted'}`}>
                              {session.is_online ? (
                                <LogIn className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">{name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {session.role && (
                                  <Badge className={`text-[10px] px-1.5 py-0 ${ROLE_COLOR[session.role] || 'bg-muted text-muted-foreground'}`}>
                                    {APP_ROLE_LABELS[session.role as keyof typeof APP_ROLE_LABELS] || session.role}
                                  </Badge>
                                )}
                                {session.is_online && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-success/10 text-success">Online</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  <Clock className="inline h-3 w-3 mr-0.5" />
                                  Active: {fmtDuration(session.active_seconds || 0)}
                                </span>
                                {session.logout_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Out: {fmtDt(session.logout_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtDt(session.login_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ActivityLogsPage;
