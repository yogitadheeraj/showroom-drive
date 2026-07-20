import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue } from 'firebase/database';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { Button } from '@/components/ui/button';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { CalendarCheck, Users, Car, MapPin, TrendingUp, Clock, Filter, Phone, Eye, MailCheck, AlertTriangle, RefreshCw, LayoutDashboard, ShieldCheck, Zap, CheckCheck, TrendingDown } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import { TestDriveInsightGrid } from './TestDriveInsightGrid';
import { StaffActivityGrid } from './StaffActivityGrid';
import TestDriveCalendarMini from './TestDriveCalendarMini';
import HierarchyOverview from './HierarchyOverview';

const DASHBOARD_PREFS_KEY = 'dashboard_superadmin_prefs_v1';

const ROLE_COLORS: Record<string, string> = {
  [APP_ROLE.DEALER_ADMIN]: 'hsl(220,80%,50%)',
  [APP_ROLE.SALES_ADMIN]: 'hsl(270,70%,55%)',
  [APP_ROLE.GRO]: 'hsl(145,65%,42%)',
  [APP_ROLE.SALES]: 'hsl(38,95%,55%)',
  [APP_ROLE.SECURITY]: 'hsl(0,75%,55%)',
  [APP_ROLE.SUPERADMIN]: 'hsl(200,80%,50%)',
};

const STATUS_COLORS = ['hsl(220,80%,50%)', 'hsl(145,65%,42%)', 'hsl(38,95%,55%)', 'hsl(0,75%,55%)', 'hsl(200,80%,50%)'];
const AUTH_EMAIL_TEMPLATES = [
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'reauthentication',
  // Keep legacy/alternate labels so older rows are still counted.
  'confirm_signup',
  'magic_link',
  'auth_emails',
];
const TEST_DRIVE_EMAIL_TEMPLATES = ['booking-confirmation', 'sales-follow-up'];

const SuperAdminDashboard = () => {
  const { role } = useAuth();
  const { dealerId: contextDealerId, loading: dealerLoading, selectedLocationId } = useDealerContext();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;

  const savedPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(DASHBOARD_PREFS_KEY) || '{}');
    } catch {
      return {} as Record<string, string>;
    }
  })();

  const [stats, setStats] = useState({ total: 0, scheduled: 0, completed: 0, noShow: 0, cancelled: 0 });
  const [dealers, setDealers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [repeatedCustomers, setRepeatedCustomers] = useState<any[]>([]);
  const [activitySessions, setActivitySessions] = useState<any[]>([]);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [selectedActivityStaff, setSelectedActivityStaff] = useState<any | null>(null);
  const [authDiagnostics, setAuthDiagnostics] = useState({
    loading: false,
    totalAuthEmails24h: 0,
    sent: 0,
    failed: 0,
    dlq: 0,
    pending: 0,
    rateLimited: 0,
    lastError: null as string | null,
    cooldownUntil: null as string | null,
    lastAuthEmailAt: null as string | null,
    customerDriveSent: 0,
    customerDriveFailed: 0,
    customerDrivePending: 0,
  });

  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const [failedAuthEmailLogs, setFailedAuthEmailLogs] = useState<any[]>([]);
  const [authFailuresDialogOpen, setAuthFailuresDialogOpen] = useState(false);

  const [selectedDealer, setSelectedDealer] = useState(savedPrefs.selectedDealer || 'all');
  const [selectedLocation, setSelectedLocation] = useState(savedPrefs.selectedLocation || 'all');
  // For dealer_admin, the global context selection drives filtering; superadmin uses internal state.
  const activeSelectedLocation = isSuperAdmin ? selectedLocation : (selectedLocationId ?? 'all');
  const [testDriveView, setTestDriveView] = useState<'grid' | 'chart' | 'calendar'>(() => (savedPrefs.testDriveView === 'chart' ? 'chart' : 'grid'));
  const [testDriveChartType, setTestDriveChartType] = useState<'pie' | 'line' | 'bar'>(() => {
    const type = savedPrefs.testDriveChartType;
    if (type === 'pie' || type === 'line' || type === 'bar') return type;
    return 'pie';
  });
  const [userInsightRoleFilter, setUserInsightRoleFilter] = useState<'all' | 'sales' | 'gro'>('all');
  const [userInsightWindow, setUserInsightWindow] = useState<'all' | 'today' | 'week' | 'month'>('month');
  const [tdLastUpdated, setTdLastUpdated] = useState<Date | null>(null);
  const [tdRefreshing, setTdRefreshing] = useState(false);
  const [tdUpdateCount, setTdUpdateCount] = useState(0);

  const activeDealerId = isSuperAdmin
    ? (selectedDealer === 'all' ? null : selectedDealer)
    : contextDealerId;
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_PREFS_KEY,
      JSON.stringify({
        selectedDealer,
        selectedLocation,
        testDriveView,
        testDriveChartType,
      })
    );
  }, [selectedDealer, selectedLocation, testDriveView, testDriveChartType]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchDealers = async () => {
      const data = await apiDbQuery<any[]>({
        table: 'dealers',
        action: 'select',
        select: 'id, name',
        filters: [{ field: 'is_active', op: 'eq', value: true }],
        order: [{ field: 'name', ascending: true }],
      });
      setDealers(data || []);
    };
    fetchDealers();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchLocations = async () => {
      const filters: Array<{ field: string; op: 'eq'; value: unknown }> = [{ field: 'is_active', op: 'eq', value: true }];
      if (activeDealerId) filters.push({ field: 'dealer_id', op: 'eq', value: activeDealerId });
      const data = await apiDbQuery<any[]>({
        table: 'locations',
        action: 'select',
        select: 'id, name, dealer_id',
        filters,
        order: [{ field: 'name', ascending: true }],
      });
      setLocations(data || []);
    };
    fetchLocations();
    setSelectedLocation('all');
  }, [activeDealerId, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchBrands = async () => {
      const filters: Array<{ field: string; op: 'eq'; value: unknown }> = [];
      if (activeDealerId) filters.push({ field: 'dealer_id', op: 'eq', value: activeDealerId });
      const data = await apiDbQuery<any[]>({
        table: 'brands',
        action: 'select',
        select: 'id, dealer_id',
        filters,
        order: [{ field: 'name', ascending: true }],
      });
      setBrands(data || []);
    };
    fetchBrands();
  }, [activeDealerId, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchStaff = async () => {
      const locationIds = activeSelectedLocation !== 'all'
        ? [activeSelectedLocation]
        : locations.map(l => l.id);
      if (locationIds.length === 0) { setStaffMembers([]); return; }

      const [profiles, roles] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'profiles',
          action: 'select',
          select: 'id, user_id, full_name, location_id, is_active',
          filters: [{ field: 'location_id', op: 'in', value: locationIds }],
          order: [{ field: 'full_name', ascending: true }],
        }),
        apiDbQuery<any[]>({
          table: 'user_roles',
          action: 'select',
          select: 'user_id, role',
        }),
      ]);

      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r]));
      const merged = (profiles || []).map((p) => ({
        ...p,
        role: roleMap.get(p.user_id)?.role || null,
      }));

      setStaffMembers(merged);
    };
    fetchStaff();
  }, [activeSelectedLocation, locations, dealerLoading, isSuperAdmin]);

  const fetchTestDrivesData = useCallback(async () => {
    if (dealerLoading && !isSuperAdmin) return;
    const locationIds = activeSelectedLocation !== 'all'
      ? [activeSelectedLocation]
      : locations.map((l: any) => l.id);
    if (locationIds.length === 0 && !isSuperAdmin) {
      setTestDrives([]); setStats({ total: 0, scheduled: 0, completed: 0, noShow: 0, cancelled: 0 }); setRepeatedCustomers([]); return;
    }

    const params = new URLSearchParams();
    params.set('limit', '500');
    params.set('include_related', 'true');
    if (locationIds.length > 0) {
      params.set('location_ids', locationIds.join(','));
    }

    const td = await apiGet<any[]>(`/api/test-drives?${params.toString()}`);

    setTestDrives(td || []);
    const total = td?.length || 0;
    setStats({
      total,
      scheduled: td?.filter((t: any) => t.status === 'scheduled').length || 0,
      completed: td?.filter((t: any) => t.status === 'completed').length || 0,
      noShow: td?.filter((t: any) => t.status === 'no_show').length || 0,
      cancelled: td?.filter((t: any) => t.status === 'cancelled').length || 0,
    });
    const customerIds = [...new Set(td?.map((t: any) => t.customer_id) || [])];
    if (customerIds.length > 0) {
      const customers = await apiDbQuery<any[]>({
        table: 'customers',
        action: 'select',
        select: '*',
        filters: [
          { field: 'total_test_drives', op: 'gt', value: 1 },
          { field: 'id', op: 'in', value: customerIds },
        ],
      });
      setRepeatedCustomers(customers || []);
    } else { setRepeatedCustomers([]); }
  }, [activeSelectedLocation, locations, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    void fetchTestDrivesData();
  }, [fetchTestDrivesData]);

  // Firestore real-time: auto-refresh Staff-wise insights when any location updates
  useEffect(() => {
    const locationIds = activeSelectedLocation !== 'all'
      ? [activeSelectedLocation]
      : locations.map((l: any) => l.id);
    if (locationIds.length === 0) return;

    let db: ReturnType<typeof getDatabase>;
    try { db = getDatabase(); } catch { return; }

    const unsubs = locationIds.map((locationId: string) => {
      let isFirst = true;
      return onValue(
        ref(db, `test_drive_events/${locationId}`),
        (snap) => {
          if (isFirst) { isFirst = false; return; }
          if (!snap.exists()) return;
          setTdRefreshing(true);
          setTdUpdateCount((c) => c + 1);
          void fetchTestDrivesData().then(() => {
            setTdRefreshing(false);
            setTdLastUpdated(new Date());
          });
        },
        () => {},
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [activeSelectedLocation, locations, fetchTestDrivesData]);

  const fetchAuthDiagnostics = useCallback(async () => {
    setAuthDiagnostics((prev) => ({ ...prev, loading: true }));

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [authEmailLogs, emailStateRows, failedLogs, customerDriveLogs] = await Promise.all([
      apiDbQuery<any[]>({
        table: 'email_send_log',
        action: 'select',
        select: 'status, error_message, created_at, template_name',
        filters: [
          { field: 'template_name', op: 'in', value: AUTH_EMAIL_TEMPLATES },
          { field: 'created_at', op: 'gte', value: since },
        ],
        order: [{ field: 'created_at', ascending: false }],
        limit: 300,
      }),
      apiDbQuery<any[]>({
        table: 'email_send_state',
        action: 'select',
        select: 'retry_after_until',
        filters: [{ field: 'id', op: 'eq', value: 1 }],
        limit: 1,
      }),
      apiDbQuery<any[]>({
        table: 'email_send_log',
        action: 'select',
        select: 'id, recipient_email, template_name, status, error_message, created_at',
        filters: [
          { field: 'template_name', op: 'in', value: AUTH_EMAIL_TEMPLATES },
          { field: 'status', op: 'in', value: ['failed', 'dlq', 'rate_limited'] },
          { field: 'created_at', op: 'gte', value: since },
        ],
        order: [{ field: 'created_at', ascending: false }],
        limit: 40,
      }),
      apiDbQuery<any[]>({
        table: 'email_send_log',
        action: 'select',
        select: 'status, template_name, created_at',
        filters: [
          { field: 'template_name', op: 'in', value: TEST_DRIVE_EMAIL_TEMPLATES },
          { field: 'created_at', op: 'gte', value: since },
        ],
        order: [{ field: 'created_at', ascending: false }],
        limit: 300,
      }),
    ]);

    const logs = authEmailLogs || [];
    const emailState = emailStateRows?.[0] || null;
    const sent = logs.filter((row) => row.status === 'sent').length;
    const failed = logs.filter((row) => row.status === 'failed').length;
    const dlq = logs.filter((row) => row.status === 'dlq').length;
    const pending = logs.filter((row) => row.status === 'pending').length;
    const rateLimited = logs.filter((row) => row.status === 'rate_limited').length;
    const errored = logs.find((row) => row.error_message);
    const driveLogs = customerDriveLogs || [];
    const customerDriveSent = driveLogs.filter((row) => row.status === 'sent').length;
    const customerDriveFailed = driveLogs.filter((row) => row.status === 'failed' || row.status === 'dlq').length;
    const customerDrivePending = driveLogs.filter((row) => row.status === 'pending').length;

    setAuthDiagnostics({
      loading: false,
      totalAuthEmails24h: logs.length,
      sent,
      failed,
      dlq,
      pending,
      rateLimited,
      lastError: errored?.error_message || null,
      cooldownUntil: emailState?.retry_after_until || null,
      lastAuthEmailAt: logs[0]?.created_at || null,
      customerDriveSent,
      customerDriveFailed,
      customerDrivePending,
    });
    setFailedAuthEmailLogs(failedLogs || []);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void fetchAuthDiagnostics();
  }, [isSuperAdmin, fetchAuthDiagnostics]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;

    const fetchActivityData = async () => {
      const locationIds = activeSelectedLocation !== 'all'
        ? [activeSelectedLocation]
        : locations.map(l => l.id);
      const activitySince = new Date();
      activitySince.setDate(activitySince.getDate() - 7);

      const sessionFilters: Array<{ field: string; op: 'gte' | 'in'; value: unknown }> = [
        { field: 'login_at', op: 'gte', value: activitySince.toISOString() },
      ];
      const eventFilters: Array<{ field: string; op: 'gte' | 'in'; value: unknown }> = [
        { field: 'happened_at', op: 'gte', value: activitySince.toISOString() },
      ];

      if (locationIds.length > 0) {
        sessionFilters.push({ field: 'location_id', op: 'in', value: locationIds });
        eventFilters.push({ field: 'location_id', op: 'in', value: locationIds });
      }

      const [sessions, events] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'staff_activity_sessions',
          action: 'select',
          select: '*',
          filters: sessionFilters,
          order: [{ field: 'login_at', ascending: false }],
          limit: 1000,
        }),
        apiDbQuery<any[]>({
          table: 'staff_activity_events',
          action: 'select',
          select: '*',
          filters: eventFilters,
          order: [{ field: 'happened_at', ascending: false }],
          limit: 1000,
        }),
      ]);

      setActivitySessions(sessions || []);
      setActivityEvents(events || []);
    };

    void fetchActivityData();
  }, [activeSelectedLocation, locations, dealerLoading, isSuperAdmin]);

  const filteredStaff = staffMembers;

  const activeSalesCount = filteredStaff.filter(
    (s) => s.role === APP_ROLE.SALES && s.is_active
  ).length;

  const dealerCount = isSuperAdmin ? dealers.length : 1;
  const locationCount = locations.length;
  const userCount = filteredStaff.length;
  const brandCount = brands.length;

  const staffRoleChartData = Object.entries(
    filteredStaff.reduce((acc: Record<string, number>, staff) => {
      const key = staff.role || 'unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const statusChartData = [
    { name: 'Scheduled', value: stats.scheduled },
    { name: 'Completed', value: stats.completed },
    { name: 'No Show', value: stats.noShow },
    { name: 'Cancelled', value: stats.cancelled },
  ].filter((s) => s.value > 0);

  const statCards = [
    { label: 'Dealers', value: dealerCount, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Locations', value: locationCount, icon: MapPin, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Users', value: userCount, icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Brands', value: brandCount, icon: Car, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Total Drives', value: stats.total, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
    { label: 'No Show', value: stats.noShow, icon: Users, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Cancelled', value: stats.cancelled, icon: Car, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Repeat', value: repeatedCustomers.length, icon: MapPin, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Active Sales Executive', value: activeSalesCount, icon: Users, color: 'text-success', bg: 'bg-success/10' },
  ];

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info',
    confirmed: 'bg-primary/10 text-primary',
    show: 'bg-success/10 text-success',
    no_show: 'bg-warning/10 text-warning',
    in_progress: 'bg-accent text-accent-foreground',
    completed: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
    rescheduled: 'bg-muted text-muted-foreground',
  };

  const testDriveTrendData = Object.entries(
    testDrives.reduce((acc: Record<string, number>, td) => {
      const dateKey = td.scheduled_date || 'Unknown';
      acc[dateKey] = (acc[dateKey] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  };

  const formatDuration = (seconds?: number | null) => {
    const totalSeconds = seconds || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const getAssignedName = (drive: any) => {
    const salesName = drive?.assigned_sales_person?.full_name;
    const groName = drive?.assigned_gro?.full_name;
    if (salesName && groName) return `${salesName} / ${groName}`;
    if (salesName) return salesName;
    if (groName) return groName;
    return 'NA';
  };

  const getStaffActivitySummary = (staff: any) => {
    const sessions = activitySessions
      .filter((session) => session.user_id === staff.user_id || session.profile_id === staff.id)
      .sort((left, right) => new Date(right.login_at).getTime() - new Date(left.login_at).getTime());
    const events = activityEvents
      .filter((event) => event.user_id === staff.user_id || event.profile_id === staff.id)
      .sort((left, right) => new Date(right.happened_at).getTime() - new Date(left.happened_at).getTime());
    const latestEvent = events[0] || null;
    const latestLogout = sessions
      .filter((session) => session.logout_at)
      .sort((left, right) => new Date(right.logout_at).getTime() - new Date(left.logout_at).getTime())[0]?.logout_at || null;
    const totalActiveSeconds = sessions.reduce((sum, session) => sum + (session.active_seconds || 0), 0);
    const totalIdleSeconds = sessions.reduce((sum, session) => sum + (session.idle_seconds || 0), 0);
    const isOnline = sessions.some((session) => {
      if (!session.is_online || session.logout_at || !session.last_seen_at) return false;
      return Date.now() - new Date(session.last_seen_at).getTime() < 5 * 60 * 1000;
    });

    return {
      lastLoginAt: sessions[0]?.login_at || staff.last_login_at,
      latestLogout,
      totalActiveSeconds,
      totalIdleSeconds,
      latestEvent,
      isOnline,
      sessions,
      events,
    };
  };

  const selectedActivitySummary = selectedActivityStaff ? getStaffActivitySummary(selectedActivityStaff) : null;
  const isEmailQueueCoolingDown = Boolean(
    authDiagnostics.cooldownUntil && new Date(authDiagnostics.cooldownUntil).getTime() > Date.now()
  );
  const hasAuthEmailFailures = authDiagnostics.failed > 0 || authDiagnostics.dlq > 0;
  const hasRecentStaffActivity = filteredStaff.some((staff) => {
    const summary = getStaffActivitySummary(staff);
    return summary.sessions.length > 0 || summary.events.length > 0;
  });

  const isDriveInInsightWindow = (drive: any) => {
    if (userInsightWindow === 'all') return true;

    const now = new Date();
    const driveDate = new Date(`${drive.scheduled_date}T00:00:00`);
    if (Number.isNaN(driveDate.getTime())) return false;

    if (userInsightWindow === 'today') {
      return driveDate.toDateString() === now.toDateString();
    }

    if (userInsightWindow === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      return driveDate >= weekAgo;
    }

    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);
    monthAgo.setHours(0, 0, 0, 0);
    return driveDate >= monthAgo;
  };

  const getJourneyMinutes = (drive: any) => {
    const start = drive.started_at || drive.security_checked_in_at || drive.key_handed_at;
    const end = drive.completed_at || drive.security_checked_out_at;
    if (!start || !end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
    return Math.round((e - s) / 60000);
  };

  const buildUserInsight = (staff: any, roleType: 'sales' | 'gro') => {
    const scopedDrives = testDrives.filter((drive) => {
      const matchesRole = roleType === 'sales'
        ? drive.assigned_sales_person_id === staff.id
        : drive.assigned_gro_id === staff.id;
      return matchesRole && isDriveInInsightWindow(drive);
    });

    const total = scopedDrives.length;
    const completed = scopedDrives.filter((d) => d.status === 'completed').length;
    const active = scopedDrives.filter((d) => ['scheduled', 'confirmed', 'show', 'in_progress', 'key_handover_to_sales'].includes(d.status)).length;
    const noShow = scopedDrives.filter((d) => d.status === 'no_show').length;
    const cancelled = scopedDrives.filter((d) => d.status === 'cancelled').length;
    const rescheduled = scopedDrives.filter((d) => d.status === 'rescheduled').length;
    const started = scopedDrives.filter((d) => Boolean(d.started_at)).length;
    const inspectionsDone = scopedDrives.filter((d) => Boolean(d.inspection_submitted_at)).length;

    const journeyValues = scopedDrives
      .map(getJourneyMinutes)
      .filter((v: number | null): v is number => typeof v === 'number');

    const avgJourneyMinutes = journeyValues.length > 0
      ? Math.round(journeyValues.reduce((sum, v) => sum + v, 0) / journeyValues.length)
      : null;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;
    const inspectionRate = completed > 0 ? Math.round((inspectionsDone / completed) * 100) : 0;

    const latestDriveAt = scopedDrives.length > 0
      ? scopedDrives
          .map((d) => new Date(`${d.scheduled_date}T${d.scheduled_time || '00:00:00'}`).getTime())
          .filter((v) => Number.isFinite(v))
          .sort((a, b) => b - a)[0]
      : null;

    return {
      id: staff.id,
      name: staff.full_name || 'Staff',
      role: roleType,
      total,
      completed,
      active,
      noShow,
      cancelled,
      rescheduled,
      started,
      inspectionsDone,
      completionRate,
      noShowRate,
      inspectionRate,
      avgJourneyMinutes,
      latestDriveAt,
    };
  };

  const userWiseInsights = filteredStaff
    .filter((staff) => {
      if (userInsightRoleFilter === 'sales') return staff.role === APP_ROLE.SALES;
      if (userInsightRoleFilter === 'gro') return staff.role === APP_ROLE.GRO;
      return staff.role === APP_ROLE.SALES || staff.role === APP_ROLE.GRO;
    })
    .map((staff) => buildUserInsight(staff, staff.role === APP_ROLE.GRO ? 'gro' : 'sales'))
    .sort((a, b) => b.total - a.total);

  const totalUserwiseDrives = userWiseInsights.reduce((sum, row) => sum + row.total, 0);
  const avgCompletionRate = userWiseInsights.length > 0
    ? Math.round(userWiseInsights.reduce((sum, row) => sum + row.completionRate, 0) / userWiseInsights.length)
    : 0;
  const avgNoShowRate = userWiseInsights.length > 0
    ? Math.round(userWiseInsights.reduce((sum, row) => sum + row.noShowRate, 0) / userWiseInsights.length)
    : 0;
  const avgJourneyMinutes = userWiseInsights.length > 0
    ? Math.round(
        userWiseInsights
          .filter((row) => row.avgJourneyMinutes !== null)
          .reduce((sum, row, _, arr) => sum + ((row.avgJourneyMinutes || 0) / Math.max(arr.length, 1)), 0)
      )
    : 0;
  const topPerformer = userWiseInsights[0] || null;
  const bestCompletionRateUser = userWiseInsights.filter(r => r.total > 0).sort((a, b) => b.completionRate - a.completionRate)[0] || null;

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Header row: title + inline filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-4 sm:pb-3 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            {isSuperAdmin ? 'Super Admin Dashboard' : 'Organization Admin Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSuperAdmin ? 'Overview across all dealerships & test drives' : 'Overview of your dealership test drives'}
          </p>
        </div>

     
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={`shadow-card min-w-0 border cursor-pointer ${stat.bg.replace('bg-', 'border-').replace('/10', '/30')}`}
              onClick={() => {
                if (stat.label === 'Locations') navigate('/locations');
                else if (stat.label === 'Brands') navigate('/settings?tab=brands');
                else if (stat.label === 'Users') navigate('/users');
                else if (stat.label === 'Dealers') navigate('/users?role=dealer_admin');
                else if (stat.label === 'Total Drives') navigate('/test-drives');
                else if (stat.label === 'Scheduled') navigate('/test-drives');
                else if (stat.label === 'Completed') navigate('/test-drives');
                else if (stat.label === 'No Show') navigate('/test-drives');
                else if (stat.label === 'Cancelled') navigate('/test-drives');
                else if (stat.label === 'Repeat') navigate('/test-drives');
                else if (stat.label === 'Active Sales Executive') navigate('/users');
              }}
            >
              <CardContent className="p-3 sm:p-4 min-w-0 flex items-center gap-2.5 sm:gap-3 min-h-[88px] sm:min-h-[96px]">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-heading font-bold leading-none text-foreground">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mt-1 break-words">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
       <HierarchyOverview />
    
      <Card className="shadow-card border-primary/20 relative overflow-hidden">
        {/* Gradient accent line at top */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-success to-info" />

        <CardHeader className="pb-3 pt-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <CardTitle className="font-heading text-base sm:text-lg flex items-center gap-2 flex-wrap">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Staff-wise Test Drive Insights
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success/10 border border-success/20 rounded-full px-2 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full bg-success ${tdRefreshing ? 'animate-ping' : 'animate-pulse'}`} />
                Live
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-primary/70 bg-primary/8 border border-primary/15 rounded-full px-2 py-0.5">
                <Zap className="h-2.5 w-2.5" /> AI Powered
              </span>
              <Badge variant="secondary" className="text-xs font-normal">{userWiseInsights.length} users</Badge>
              {tdUpdateCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-success rounded-full px-2 py-0.5 animate-bounce">
                  +{tdUpdateCount} live
                </span>
              )}
            </CardTitle>

            <div className="flex items-center gap-2 flex-wrap">
              {tdRefreshing ? (
                <span className="flex items-center gap-1 text-[11px] text-success font-medium animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Updating...
                </span>
              ) : tdLastUpdated ? (
                <span className="text-[11px] text-muted-foreground">
                  Updated {tdLastUpdated.toLocaleTimeString()}
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Refresh now"
                onClick={() => {
                  setTdRefreshing(true);
                  void fetchTestDrivesData().then(() => {
                    setTdRefreshing(false);
                    setTdLastUpdated(new Date());
                  });
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${tdRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Select value={userInsightRoleFilter} onValueChange={(v: 'all' | 'sales' | 'gro') => setUserInsightRoleFilter(v)}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="gro">GRO</SelectItem>
                </SelectContent>
              </Select>

              <Select value={userInsightWindow} onValueChange={(v: 'all' | 'today' | 'week' | 'month') => setUserInsightWindow(v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Summary metrics ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="rounded-xl border border-info/20 bg-info/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><Car className="h-3 w-3" /> Total Drives</p>
              <p className="text-2xl font-heading font-bold text-foreground">{totalUserwiseDrives}</p>
            </div>
            <div className="rounded-xl border border-success/20 bg-success/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><CheckCheck className="h-3 w-3 text-success" /> Avg Completion</p>
              <p className="text-2xl font-heading font-bold text-success">{avgCompletionRate}%</p>
              <div className="h-1 bg-success/20 rounded-full"><div className="h-full bg-success rounded-full" style={{ width: `${Math.min(avgCompletionRate, 100)}%` }} /></div>
            </div>
            <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><TrendingDown className="h-3 w-3 text-warning" /> Avg No-show</p>
              <p className="text-2xl font-heading font-bold text-warning">{avgNoShowRate}%</p>
              <div className="h-1 bg-warning/20 rounded-full"><div className="h-full bg-warning rounded-full" style={{ width: `${Math.min(avgNoShowRate, 100)}%` }} /></div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><Clock className="h-3 w-3 text-primary" /> Avg Journey</p>
              <p className="text-2xl font-heading font-bold text-foreground">{avgJourneyMinutes > 0 ? `${avgJourneyMinutes}m` : '—'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/30 p-3 flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3 text-amber-600" /> Top Performer</p>
              <p className="text-sm font-bold text-foreground truncate leading-tight">{topPerformer?.name || '—'}</p>
              <p className="text-[11px] text-muted-foreground">{topPerformer ? `${topPerformer.completed} completed` : 'No data'}</p>
            </div>
            <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1"><Zap className="h-3 w-3 text-success" /> Best Rate</p>
              {bestCompletionRateUser ? (
                <>
                  <p className="text-2xl font-heading font-bold text-success leading-tight">{bestCompletionRateUser.completionRate}%</p>
                  <p className="text-[11px] font-semibold text-foreground truncate">{bestCompletionRateUser.name}</p>
                  <p className="text-[10px] text-muted-foreground">{bestCompletionRateUser.completed}/{bestCompletionRateUser.total} drives</p>
                </>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>

          {/* ── AI Insight bar ── */}
          {userWiseInsights.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/5 to-info/5 border border-primary/15 px-4 py-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">AI Summary</p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {bestCompletionRateUser
                    ? <><span className="font-semibold text-foreground">{bestCompletionRateUser.name}</span> leads with <span className="font-semibold text-success">{bestCompletionRateUser.completionRate}%</span> completion ({bestCompletionRateUser.completed}/{bestCompletionRateUser.total} drives). </>
                    : null}
                  {avgNoShowRate > 20
                    ? <><span className="text-warning font-medium">No-show rate is elevated at {avgNoShowRate}%</span> — consider sending follow-up reminders. </>
                    : <>No-show rate is healthy at <span className="text-success font-medium">{avgNoShowRate}%</span>. </>}
                  {userWiseInsights.length} staff tracked
                  {userInsightWindow === 'today' ? ' today' : userInsightWindow === 'week' ? ' over the last 7 days' : userInsightWindow === 'month' ? ' over the last 30 days' : ' across all time'}.
                </p>
              </div>
            </div>
          )}

          {/* ── Staff rows ── */}
          {userWiseInsights.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No user-wise drive data found for selected filters.
            </div>
          ) : (
            <div className="space-y-2">
              {userWiseInsights.map((row, idx) => {
                const tier = row.completionRate >= 70 ? 'elite' : row.completionRate >= 40 ? 'good' : 'review';
                const tierConfig = {
                  elite: { label: '🔥 Top', bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
                  good:  { label: '✓ Good', bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
                  review: { label: '⚠ Review', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
                }[tier];
                const barColor = tier === 'elite' ? 'bg-success' : tier === 'good' ? 'bg-info' : 'bg-warning';
                const textColor = tier === 'elite' ? 'text-success' : tier === 'good' ? 'text-info' : 'text-warning';
                const initials = row.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                const avatarBg = row.role === 'sales' ? 'bg-info/15 text-info' : 'bg-success/15 text-success';

                return (
                  <div
                    key={`${row.role}-${row.id}`}
                    className="group flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/20 transition-all duration-200"
                  >
                    {/* Rank */}
                    <span className="w-6 text-xs font-bold text-muted-foreground text-center shrink-0">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>

                    {/* Avatar */}
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${avatarBg}`}>
                      {initials}
                    </div>

                    {/* Name + bar */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{row.name}</span>
                        <Badge className={row.role === 'sales' ? 'bg-info/10 text-info text-[10px] border-none' : 'bg-success/10 text-success text-[10px] border-none'}>
                          {row.role === 'sales' ? 'Sales' : 'GRO'}
                        </Badge>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${tierConfig.bg} ${tierConfig.text} ${tierConfig.border}`}>
                          {tierConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[180px]">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${textColor}`}>{row.completionRate}%</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-center">
                      <div>
                        <p className="font-bold text-foreground leading-tight">{row.total}</p>
                        <p className="text-muted-foreground leading-tight">Total</p>
                      </div>
                      <div>
                        <p className="font-bold text-success leading-tight">{row.completed}</p>
                        <p className="text-muted-foreground leading-tight">Done</p>
                      </div>
                      <div>
                        <p className="font-bold text-info leading-tight">{row.active}</p>
                        <p className="text-muted-foreground leading-tight">Active</p>
                      </div>
                      <div>
                        <p className="font-bold text-warning leading-tight">{row.noShow}</p>
                        <p className="text-muted-foreground leading-tight">No-show</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="font-bold text-foreground leading-tight">{row.cancelled}</p>
                        <p className="text-muted-foreground leading-tight">Cancelled</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="font-bold text-foreground leading-tight">{row.avgJourneyMinutes ? `${row.avgJourneyMinutes}m` : '—'}</p>
                        <p className="text-muted-foreground leading-tight">Avg Trip</p>
                      </div>
                      <div className="hidden xl:block">
                        <p className="font-bold text-[11px] text-foreground leading-tight">
                          {row.latestDriveAt ? new Date(row.latestDriveAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                        </p>
                        <p className="text-muted-foreground leading-tight">Last Drive</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

   
      <Card className="shadow-card">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Test Drives
              <Badge variant="secondary" className="text-xs font-normal">{testDrives.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={testDriveView === 'grid' ? 'default' : 'outline'}
                onClick={() => setTestDriveView('grid')}
              >
                Grid
              </Button>
              <Button
                size="sm"
                variant={testDriveView === 'chart' ? 'default' : 'outline'}
                onClick={() => setTestDriveView('chart')}
              >
                Chart
              </Button>
              <Button
                size="sm"
                variant={testDriveView === 'calendar' ? 'default' : 'outline'}
                onClick={() => setTestDriveView('calendar')}
              >
                Calendar
              </Button>
              {testDriveView === 'chart' && (
                <Select value={testDriveChartType} onValueChange={(v: 'pie' | 'line' | 'bar') => setTestDriveChartType(v)}>
                  <SelectTrigger className="w-[120px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pie">Pie</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {testDriveView === 'calendar' ? (
            <TestDriveCalendarMini testDrives={testDrives} />
          ) : testDriveView === 'chart' ? (
            <ResponsiveContainer width="100%" height={300}>
              {testDriveChartType === 'pie' ? (
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                    {statusChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : testDriveChartType === 'line' ? (
                <LineChart data={testDriveTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(220,80%,50%)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <BarChart data={testDriveTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(145,65%,42%)" />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-muted-foreground font-medium">Customer</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Vehicle</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Location</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Date</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Source</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testDrives.map(td => (
                      <tr key={td.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{td.customers?.phone}</p>
                        </td>
                        <td className="p-3 text-foreground">{td.vehicles?.brand} {td.vehicles?.model}</td>
                        <td className="p-3 text-muted-foreground">{td.locations?.name}</td>
                        <td className="p-3 text-muted-foreground">{td.scheduled_date} {td.scheduled_time}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className={statusColor[td.status] || ''}>{formatStatusLabel(td.status)}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{td.source}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{getAssignedName(td)}</td>
                      </tr>
                    ))}
                    {testDrives.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No test drives found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden space-y-3">
                {testDrives.length === 0 ? (
                  <Card className="shadow-card"><CardContent className="p-8 text-center text-muted-foreground">No test drives found</CardContent></Card>
                ) : testDrives.map(td => (
                  <Card key={td.id} className="shadow-card hover:shadow-elevated transition-shadow">
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-heading font-semibold text-sm text-foreground">{td.customers?.full_name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{td.customers?.phone}
                          </div>
                        </div>
                        <Badge variant="secondary" className={`text-xs ${statusColor[td.status] || ''}`}>{formatStatusLabel(td.status)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div className="flex items-center gap-1"><Car className="h-3 w-3 text-muted-foreground" /><span className="text-foreground truncate">{td.vehicles?.brand} {td.vehicles?.model}</span></div>
                        <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground truncate">{td.locations?.name}</span></div>
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">{td.scheduled_date}</span></div>
                        <div className="col-span-2 text-muted-foreground">
                          Assigned: <span className="text-foreground">{getAssignedName(td)}</span>
                        </div>
                        <div><Badge variant="outline" className="capitalize text-[10px]">{td.source}</Badge></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Drive Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusChartData.map((_, index) => (
                    <Cell key={index} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-info" /> Staff Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={staffRoleChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                  {staffRoleChartData.map((entry, index) => (
                    <Cell key={index} fill={ROLE_COLORS[entry.name] || STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" /> Staff Activity Grid
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasRecentStaffActivity && filteredStaff.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              No recent staff activity found in the last 7 days for the selected location.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Role</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Location</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Last Login</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Logoff</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Active</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Idle</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Latest Activity</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Logs</th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((staff) => {
                  const summary = getStaffActivitySummary(staff);

                  return (
                    <tr key={staff.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium text-foreground">{staff.full_name}</td>
                      <td className="p-3 text-muted-foreground capitalize">{staff.role || '-'}</td>
                      <td className="p-3 text-muted-foreground">
                        {locations.find((l) => l.id === staff.location_id)?.name || '-'}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="secondary"
                          className={summary.isOnline ? 'bg-success/10 text-success' : staff.is_active ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground'}
                        >
                          {summary.isOnline ? 'Online' : staff.is_active ? 'Available' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDateTime(summary.lastLoginAt)}</td>
                      <td className="p-3 text-muted-foreground">{summary.isOnline ? 'Online' : formatDateTime(summary.latestLogout)}</td>
                      <td className="p-3 text-muted-foreground">{formatDuration(summary.totalActiveSeconds)}</td>
                      <td className="p-3 text-muted-foreground">{formatDuration(summary.totalIdleSeconds)}</td>
                      <td className="p-3">
                        {summary.latestEvent ? (
                          <div>
                            <p className="text-foreground">{summary.latestEvent.event_label}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(summary.latestEvent.happened_at)}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No activity yet</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" onClick={() => setSelectedActivityStaff(staff)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No staff found for the selected location</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedActivityStaff} onOpenChange={(open) => !open && setSelectedActivityStaff(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedActivityStaff?.full_name ? `${selectedActivityStaff.full_name} Activity Log` : 'Staff Activity Log'}
            </DialogTitle>
            <DialogDescription>
              Full-day login, logout, idle, and work activity timeline for the selected staff member.
            </DialogDescription>
          </DialogHeader>

          {selectedActivityStaff && selectedActivitySummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Last Login</p>
                    <p className="text-sm font-semibold text-foreground">{formatDateTime(selectedActivitySummary.lastLoginAt)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Last Logoff</p>
                    <p className="text-sm font-semibold text-foreground">{selectedActivitySummary.isOnline ? 'Online' : formatDateTime(selectedActivitySummary.latestLogout)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Active Time</p>
                    <p className="text-sm font-semibold text-foreground">{formatDuration(selectedActivitySummary.totalActiveSeconds)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Idle Time</p>
                    <p className="text-sm font-semibold text-foreground">{formatDuration(selectedActivitySummary.totalIdleSeconds)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-base">Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedActivitySummary.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity recorded today.</p>
                    ) : (
                      selectedActivitySummary.events.map((event: any) => (
                        <div key={event.id} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{event.event_label}</p>
                            <p className="text-xs text-muted-foreground capitalize">{event.event_type.replace(/_/g, ' ')}</p>
                            {event.route && <p className="text-xs text-muted-foreground">Route: {event.route}</p>}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(event.happened_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Repeat Customers */}
      {repeatedCustomers.length > 0 && (
        <>
          {/* Desktop */}
          <Card className="shadow-card hidden lg:block">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-warning" /> Repeat Customers
                <Badge variant="secondary" className="text-xs font-normal ml-1">{repeatedCustomers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Phone</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Total Drives</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repeatedCustomers.map(c => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="p-3 font-medium text-foreground">{c.full_name}</td>
                        <td className="p-3 text-muted-foreground">{c.phone}</td>
                        <td className="p-3 text-muted-foreground">{c.email || '-'}</td>
                        <td className="p-3"><Badge className="bg-black text-accent-foreground">{c.total_test_drives}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile */}
          <div className="lg:hidden space-y-3">
            <h2 className="text-base font-heading font-semibold text-foreground">Repeat Customers</h2>
            {repeatedCustomers.map(c => (
              <Card key={c.id} className="shadow-card">
                <CardContent className="p-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                  <Badge className="bg-accent/10 text-accent-foreground">{c.total_test_drives} drives</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

    

      {isSuperAdmin && (
        <Card className="shadow-card border-primary/20">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-primary" />
                Auth Diagnostics (24h)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void fetchAuthDiagnostics()}
                  disabled={authDiagnostics.loading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${authDiagnostics.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAuthFailuresDialogOpen(true)}
                  disabled={failedAuthEmailLogs.length === 0}
                >
                  View Failures
                </Button>
                <Badge
                  variant="secondary"
                  className={
                    authDiagnostics.loading
                      ? 'bg-muted text-muted-foreground'
                      : hasAuthEmailFailures || isEmailQueueCoolingDown
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                  }
                >
                  {authDiagnostics.loading
                    ? 'Refreshing'
                    : hasAuthEmailFailures
                      ? 'Action Needed'
                      : isEmailQueueCoolingDown
                        ? 'Rate Limited'
                        : 'Healthy'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">Queued/Logged</p>
                <p className="text-xl font-heading font-bold text-foreground">{authDiagnostics.totalAuthEmails24h}</p>
              </div>
              <div className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-xl font-heading font-bold text-success">{authDiagnostics.sent}</p>
              </div>
              <div className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-xl font-heading font-bold text-destructive">{authDiagnostics.failed}</p>
              </div>
              <div className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">DLQ</p>
                <p className="text-xl font-heading font-bold text-warning">{authDiagnostics.dlq}</p>
              </div>
              <div className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-heading font-bold text-primary">{authDiagnostics.pending}</p>
              </div>
              <div className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">Rate Limited</p>
                <p className="text-xl font-heading font-bold text-warning">{authDiagnostics.rateLimited}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-2">Customer Test-Drive Emails (24h)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">Sent</p>
                  <p className="text-base font-semibold text-success">{authDiagnostics.customerDriveSent}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Failed/DLQ</p>
                  <p className="text-base font-semibold text-destructive">{authDiagnostics.customerDriveFailed}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Pending</p>
                  <p className="text-base font-semibold text-primary">{authDiagnostics.customerDrivePending}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Last auth email event</p>
                <p className="text-sm text-foreground font-medium">{formatDateTime(authDiagnostics.lastAuthEmailAt)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Queue cooldown</p>
                <p className="text-sm text-foreground font-medium">
                  {isEmailQueueCoolingDown ? `Retry after ${formatDateTime(authDiagnostics.cooldownUntil)}` : 'Not rate limited'}
                </p>
              </div>
            </div>

            {authDiagnostics.lastError && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                <p className="text-xs text-warning flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Latest error
                </p>
                <p className="text-sm text-foreground break-all">{authDiagnostics.lastError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={authFailuresDialogOpen} onOpenChange={setAuthFailuresDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auth Email Failures (Last 24h)</DialogTitle>
            <DialogDescription>
              Recent failed, DLQ, and rate-limited auth emails to help debug signup verification delivery.
            </DialogDescription>
          </DialogHeader>

          {failedAuthEmailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failed auth email logs in the last 24 hours.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-medium">Time</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Recipient</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Template</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedAuthEmailLogs.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 align-top">
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                      <td className="p-2 text-foreground">{row.recipient_email}</td>
                      <td className="p-2 text-muted-foreground">{row.template_name}</td>
                      <td className="p-2">
                        <Badge variant="secondary" className={row.status === 'dlq' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-foreground break-all">{row.error_message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
