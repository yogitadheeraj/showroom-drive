import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityInsightsMini } from '@/components/ActivityInsightsMini';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarCheck, Users, Car, TrendingUp, Clock, ShieldCheck,
  CheckCircle2, AlertCircle, Eye, Filter, LayoutDashboard, MapPin,
  LayoutGrid, LayoutList, Activity,
} from 'lucide-react';
import { APP_ROLE, APP_ROLE_LABELS, APP_ROLE_BADGE_CLASS } from '@/constants/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';
import { TestDriveInsightGrid } from './TestDriveInsightGrid';
import { StaffActivityGrid } from './StaffActivityGrid';
import TestDriveCalendarMini from './TestDriveCalendarMini';

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-info/10 text-info border-info/20',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  show: 'bg-success/10 text-success border-success/20',
  no_show: 'bg-warning/10 text-warning border-warning/20',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  key_handover_to_sales: 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  rescheduled: 'bg-muted text-muted-foreground border-border',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const formatStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const BranchAdminDashboard = () => {
  const { profile } = useAuth();
  const locationId = profile?.location_id;

  const [locationInfo, setLocationInfo] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [allDrives, setAllDrives] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [driveView, setDriveView] = useState<'list' | 'grid' | 'calendar'>('list');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [insightRoleFilter, setInsightRoleFilter] = useState<'all' | 'sales' | 'gro'>('all');
  const [insightWindow, setInsightWindow] = useState<'all' | 'today' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);
  const [detailSheetDrive, setDetailSheetDrive] = useState<any>(null);

  useEffect(() => {
    if (!locationId) return;
    fetchAll();
  }, [locationId]);

  useTestDriveRealtime(locationId, () => {
    void fetchDrives();
  });

  const fetchDrives = async () => {
    const drives = await apiGet<any[]>(`/api/test-drives?location_id=${locationId}&limit=300`);
    setAllDrives(drives || []);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Location info
      const loc = await apiGet<any>(`/api/locations/${locationId}`);
      setLocationInfo(loc);

      // All staff + roles for this location
      const [profileList, allRoles] = await Promise.all([
        apiGet<any[]>(`/api/profiles?location_id=${locationId}`),
        apiGet<any[]>('/api/user-roles'),
      ]);

      const rolesMap = ((allRoles || []) as any[]).reduce<Record<string, string>>((acc, r) => {
        acc[r.user_id] = r.role;
        return acc;
      }, {});

      const enrichedStaff = ((profileList || []) as any[]).map((p) => ({
        ...p,
        role: rolesMap[p.user_id] || null,
      }));
      setStaff(enrichedStaff);

      // All test drives for this location
      await fetchDrives();
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────
  const groStaff = staff.filter(s => s.role === APP_ROLE.GRO);
  const salesStaff = staff.filter(s => s.role === APP_ROLE.SALES);
  const securityStaff = staff.filter(s => s.role === APP_ROLE.SECURITY);
  const onlineStaff = staff.filter(s => s.is_active !== false);

  const completedDrives = allDrives.filter(d => d.status === 'completed');
  const activeDrives = allDrives.filter(d =>
    ['scheduled', 'confirmed', 'show', 'in_progress', 'key_handover_to_sales'].includes(d.status)
  );

  const isDriveInInsightWindow = (drive: any) => {
    if (insightWindow === 'all') return true;

    const now = new Date();
    const driveDate = new Date(`${drive.scheduled_date}T00:00:00`);
    if (Number.isNaN(driveDate.getTime())) return false;

    if (insightWindow === 'today') {
      return driveDate.toDateString() === now.toDateString();
    }

    if (insightWindow === 'week') {
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

  const buildUserInsight = (member: any, roleType: 'sales' | 'gro') => {
    const memberDrives = allDrives.filter((drive) => {
      const isAssigned = roleType === 'sales'
        ? drive.assigned_sales_person_id === member.id
        : drive.assigned_gro_id === member.id;
      return isAssigned && isDriveInInsightWindow(drive);
    });

    const completed = memberDrives.filter(d => d.status === 'completed').length;
    const active = memberDrives.filter(d => ['scheduled', 'confirmed', 'show', 'in_progress', 'key_handover_to_sales'].includes(d.status)).length;
    const noShow = memberDrives.filter(d => d.status === 'no_show').length;
    const cancelled = memberDrives.filter(d => d.status === 'cancelled').length;
    const rescheduled = memberDrives.filter(d => d.status === 'rescheduled').length;

    const journeyMinutes = memberDrives
      .map(getJourneyMinutes)
      .filter((v: number | null): v is number => typeof v === 'number');
    const avgJourneyMinutes = journeyMinutes.length > 0
      ? Math.round(journeyMinutes.reduce((sum, v) => sum + v, 0) / journeyMinutes.length)
      : null;

    const completionRate = memberDrives.length > 0
      ? Math.round((completed / memberDrives.length) * 100)
      : 0;

    const noShowRate = memberDrives.length > 0
      ? Math.round((noShow / memberDrives.length) * 100)
      : 0;

    const latestDriveAt = memberDrives.length > 0
      ? memberDrives
          .map((d) => new Date(`${d.scheduled_date}T${d.scheduled_time || '00:00:00'}`).getTime())
          .filter((v) => Number.isFinite(v))
          .sort((a, b) => b - a)[0]
      : null;

    return {
      id: member.id,
      name: member.full_name || 'Staff',
      role: roleType,
      total: memberDrives.length,
      completed,
      active,
      noShow,
      cancelled,
      rescheduled,
      completionRate,
      noShowRate,
      avgJourneyMinutes,
      latestDriveAt,
    };
  };

  const userWiseInsights = [
    ...salesStaff.map((member) => buildUserInsight(member, 'sales')),
    ...groStaff.map((member) => buildUserInsight(member, 'gro')),
  ]
    .filter((row) => insightRoleFilter === 'all' || row.role === insightRoleFilter)
    .sort((a, b) => b.total - a.total);

  const topPerformer = userWiseInsights[0] || null;
  const avgCompletionRate = userWiseInsights.length > 0
    ? Math.round(userWiseInsights.reduce((sum, row) => sum + row.completionRate, 0) / userWiseInsights.length)
    : 0;
  const avgNoShowRate = userWiseInsights.length > 0
    ? Math.round(userWiseInsights.reduce((sum, row) => sum + row.noShowRate, 0) / userWiseInsights.length)
    : 0;
  const totalUserwiseDrives = userWiseInsights.reduce((sum, row) => sum + row.total, 0);

  // Drives per sales person
  const salesPersonStats = salesStaff.map(s => {
    const myDrives = allDrives.filter(d => d.assigned_sales_person?.id === s.id);
    return {
      ...s,
      total: myDrives.length,
      completed: myDrives.filter(d => d.status === 'completed').length,
      active: myDrives.filter(d => ['scheduled', 'confirmed', 'show', 'in_progress', 'key_handover_to_sales'].includes(d.status)).length,
      drives: myDrives,
    };
  });

  // Drives per GRO (gro_id)
  const groStats = groStaff.map(g => {
    const myDrives = allDrives.filter(d => d.assigned_gro?.id === g.id);
    return {
      ...g,
      total: myDrives.length,
      completed: myDrives.filter(d => d.status === 'completed').length,
      active: myDrives.filter(d => ['scheduled', 'confirmed', 'show', 'in_progress'].includes(d.status)).length,
      drives: myDrives,
    };
  });

  // Status distribution
  const statusDistribution = Object.entries(
    allDrives.reduce((acc: Record<string, number>, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: formatStatus(name), value }));

  const userPerformanceChartData = userWiseInsights.map((row) => ({
    name: row.name?.split(' ').slice(0, 2).join(' ') || (row.role === 'sales' ? 'Sales' : 'GRO'),
    Assigned: row.total,
    Completed: row.completed,
    Active: row.active,
  }));

  const personOptions = [
    ...salesStaff.map((s) => ({ value: `sales:${s.id}`, label: s.full_name || 'Sales', role: 'sales' as const })),
    ...groStaff.map((g) => ({ value: `gro:${g.id}`, label: g.full_name || 'GRO', role: 'gro' as const })),
  ].sort((a, b) => a.label.localeCompare(b.label));

  // Filtered drives for the drives table
  const filteredDrives = allDrives.filter(d => {
    const roleMatch = selectedRole === 'all'
      || (selectedRole === 'sales' && d.assigned_sales_person?.id)
      || (selectedRole === 'gro' && d.assigned_gro?.id);

    const personMatch = (() => {
      if (selectedPerson === 'all') return true;
      const [personRole, personId] = selectedPerson.split(':');
      if (!personRole || !personId) return true;
      if (personRole === 'sales') return d.assigned_sales_person_id === personId;
      if (personRole === 'gro') return d.assigned_gro_id === personId;
      return true;
    })();

    const statusMatch = selectedStatus === 'all' || d.status === selectedStatus;
    return roleMatch && personMatch && statusMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="animate-spin h-10 w-10 rounded-full border-t-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading branch data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Branch Admin Dashboard
          </h1>
          {locationInfo && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {locationInfo.name}{locationInfo.address ? ` · ${locationInfo.address}` : ''}
            </p>
          )}
        </div>
        <Badge className="h-fit bg-purple-100 text-purple-700 border border-purple-200 self-start">
          Branch Admin
        </Badge>
      </div>

      {/* ── KPI cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Staff', value: staff.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
          { label: 'GRO', value: groStaff.length, icon: CalendarCheck, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
          { label: 'Sales', value: salesStaff.length, icon: TrendingUp, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
          { label: 'Security', value: securityStaff.length, icon: ShieldCheck, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
          { label: 'Active Drives', value: activeDrives.length, icon: Car, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
          { label: 'Completed', value: completedDrives.length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`shadow-card min-w-0 border ${stat.border}`}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2.5">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold leading-none">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Activity Insights ── */}
      <ActivityInsightsMini />

      {/* ── USER-WISE INSIGHTS (single rich component) ─────── */}
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Staff-wise Test Drive Insights
              <Badge variant="secondary" className="text-xs font-normal ml-1">{userWiseInsights.length} users</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={insightRoleFilter} onValueChange={(v: 'all' | 'sales' | 'gro') => setInsightRoleFilter(v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="sales">Sales Only</SelectItem>
                  <SelectItem value="gro">GRO Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={insightWindow} onValueChange={(v: 'all' | 'today' | 'week' | 'month') => setInsightWindow(v)}>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-lg border border-info/20 bg-info/5 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Total Drives</p>
              <p className="text-xl font-heading font-bold">{totalUserwiseDrives}</p>
            </div>
            <div className="rounded-lg border border-success/20 bg-success/5 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Avg Completion Rate</p>
              <p className="text-xl font-heading font-bold text-success">{avgCompletionRate}%</p>
            </div>
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Avg No-show Rate</p>
              <p className="text-xl font-heading font-bold text-warning">{avgNoShowRate}%</p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Top Performer</p>
           
              <p className="text-sm font-semibold text-foreground truncate">{topPerformer?.name || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{topPerformer ? `${topPerformer.completed} completed` : 'No data'}</p>
            </div>
          </div>

          {userWiseInsights.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No user-wise drive data found for selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">User</th>
                    <th className="text-left py-2 px-2 font-medium">Role</th>
                    <th className="text-right py-2 px-2 font-medium">Assigned</th>
                    <th className="text-right py-2 px-2 font-medium">Completed</th>
                    <th className="text-right py-2 px-2 font-medium">Active</th>
                    <th className="text-right py-2 px-2 font-medium">No-show</th>
                    <th className="text-right py-2 px-2 font-medium">Cancelled</th>
                    <th className="text-right py-2 px-2 font-medium">Completion %</th>
                    <th className="text-right py-2 px-2 font-medium">Avg Journey</th>
                    <th className="text-left py-2 px-2 font-medium">Last Drive</th>
                  </tr>
                </thead>
                <tbody>
                  {userWiseInsights.map((row) => (
                    <tr key={`${row.role}-${row.id}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="py-2 px-2 font-medium text-foreground">{row.name}</td>
                      <td className="py-2 px-2">
                        <Badge className={row.role === 'sales' ? 'bg-info/10 text-info text-[10px]' : 'bg-success/10 text-success text-[10px]'}>
                          {row.role === 'sales' ? 'Sales' : 'GRO'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">{row.total}</td>
                      <td className="py-2 px-2 text-right text-success font-medium">{row.completed}</td>
                      <td className="py-2 px-2 text-right text-info font-medium">{row.active}</td>
                      <td className="py-2 px-2 text-right text-warning font-medium">{row.noShow}</td>
                      <td className="py-2 px-2 text-right text-destructive font-medium">{row.cancelled}</td>
                      <td className="py-2 px-2 text-right">
                        <Badge className={row.completionRate >= 70 ? 'bg-success/10 text-success text-[10px]' : row.completionRate >= 40 ? 'bg-warning/10 text-warning text-[10px]' : 'bg-destructive/10 text-destructive text-[10px]'}>
                          {row.completionRate}%
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">{row.avgJourneyMinutes ? `${row.avgJourneyMinutes}m` : 'N/A'}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {row.latestDriveAt ? new Date(row.latestDriveAt).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tabs ───────────────────────────────────── */}
      <Tabs defaultValue="staff-overview">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full sm:w-auto">
          <TabsTrigger value="staff-overview">Staff Overview</TabsTrigger>
          <TabsTrigger value="sales-team">Sales Team</TabsTrigger>
          <TabsTrigger value="gro-team">GRO Team</TabsTrigger>
          <TabsTrigger value="test-drives">Test Drives</TabsTrigger>
          <TabsTrigger value="staff-activity"><Activity className="h-3.5 w-3.5 mr-1" />Staff Activity</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        {/* ── STAFF OVERVIEW ── */}
        <TabsContent value="staff-overview" className="mt-4 space-y-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> All Location Staff
                <Badge variant="secondary" className="text-xs font-normal ml-1">{staff.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No staff assigned to this location.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {staff.map(s => {
                    const myDrives = allDrives.filter(d =>
                      d.assigned_sales_person?.id === s.id || d.assigned_gro?.id === s.id
                    );
                    return (
                      <div key={s.id} className="rounded-lg border border-border p-3 space-y-2 bg-card/50">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">{s.phone || 'No phone'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {s.role && (
                              <Badge className={`text-[10px] ${APP_ROLE_BADGE_CLASS[s.role as keyof typeof APP_ROLE_BADGE_CLASS] || 'bg-muted text-muted-foreground'}`}>
                                {APP_ROLE_LABELS[s.role as keyof typeof APP_ROLE_LABELS] || s.role}
                              </Badge>
                            )}
                            <Badge variant={s.is_active !== false ? 'outline' : 'secondary'} className="text-[10px]">
                              {s.is_active !== false ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        {myDrives.length > 0 && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-2">
                            <span className="flex items-center gap-1">
                              <CalendarCheck className="h-3 w-3" /> {myDrives.length} assigned
                            </span>
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle2 className="h-3 w-3" /> {myDrives.filter(d => d.status === 'completed').length} done
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SALES TEAM ── */}
        <TabsContent value="sales-team" className="mt-4 space-y-4">
          {salesPersonStats.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No sales staff assigned to this location.
              </CardContent>
            </Card>
          ) : salesPersonStats.map(s => (
            <Card key={s.id} className="shadow-card border-info/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm sm:text-base font-heading flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-info" />
                    {s.full_name}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="text-xs bg-info/10 text-info">{s.total} Assigned</Badge>
                    <Badge className="text-xs bg-success/10 text-success">{s.completed} Completed</Badge>
                    <Badge className="text-xs bg-warning/10 text-warning">{s.active} Active</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {s.drives.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No drives assigned.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {s.drives.map((d: any) => (
                      <DriveRow key={d.id} drive={d} onViewDetails={setDetailSheetDrive} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── GRO TEAM ── */}
        <TabsContent value="gro-team" className="mt-4 space-y-4">
          {groStats.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No GRO staff assigned to this location.
              </CardContent>
            </Card>
          ) : groStats.map(g => (
            <Card key={g.id} className="shadow-card border-success/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm sm:text-base font-heading flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-success" />
                    {g.full_name}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="text-xs bg-primary/10 text-primary">{g.total} Managed</Badge>
                    <Badge className="text-xs bg-success/10 text-success">{g.completed} Completed</Badge>
                    <Badge className="text-xs bg-info/10 text-info">{g.active} Active</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {g.drives.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No drives managed.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {g.drives.map((d: any) => (
                      <DriveRow key={d.id} drive={d} onViewDetails={setDetailSheetDrive} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── TEST DRIVES (merged List + Grid) ── */}
        <TabsContent value="test-drives" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-foreground">All Test Drives <span className="text-muted-foreground">({filteredDrives.length})</span></p>
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
              <Button size="sm" variant={driveView === 'list' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-xs" onClick={() => setDriveView('list')}>
                <LayoutList className="h-3.5 w-3.5 mr-1" /> List
              </Button>
              <Button size="sm" variant={driveView === 'grid' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-xs" onClick={() => setDriveView('grid')}>
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Grid
              </Button>
              <Button size="sm" variant={driveView === 'calendar' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-xs" onClick={() => setDriveView('calendar')}>
                <CalendarCheck className="h-3.5 w-3.5 mr-1" /> Calendar
              </Button>
            </div>
          </div>
          {driveView === 'calendar' ? (
            <TestDriveCalendarMini testDrives={allDrives} />
          ) : driveView === 'grid' ? (
            <TestDriveInsightGrid testDrives={allDrives} title="Test Drive Grid" />
          ) : (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" /> All Test Drives
                  <Badge variant="secondary" className="text-xs font-normal ml-1">{filteredDrives.length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="gro">GRO</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="All People" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All People</SelectItem>
                      {personOptions.map((person) => (
                        <SelectItem key={person.value} value={person.value}>
                          {person.label} ({person.role === 'sales' ? 'Sales' : 'GRO'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {['scheduled', 'confirmed', 'show', 'no_show', 'in_progress', 'key_handover_to_sales', 'completed', 'cancelled', 'rescheduled'].map(s => (
                        <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDrives.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No test drives match current filters.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredDrives.map(d => (
                    <DriveRow key={d.id} drive={d} showAssigned onViewDetails={setDetailSheetDrive} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* ── STAFF ACTIVITY ── */}
        <TabsContent value="staff-activity" className="mt-4">
          <StaffActivityGrid />
        </TabsContent>

        {/* ── CHARTS ── */}
        <TabsContent value="charts" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-info" /> Test Drives by Person
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userPerformanceChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No sales data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={userPerformanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Assigned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Active" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> Drive Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {statusDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Test Drive Detail Sheet */}
      <TestDriveDetailSheet
        testDrive={detailSheetDrive}
        open={!!detailSheetDrive}
        onClose={() => setDetailSheetDrive(null)}
      />
    </div>
  );
};

// ── Shared small drive row component ─────────────────────────
interface DriveRowProps {
  drive: any;
  showAssigned?: boolean;
  onViewDetails?: (drive: any) => void;
}

const DriveRow = ({ drive, showAssigned, onViewDetails }: DriveRowProps) => (
  <div
    className="rounded-lg border border-border p-2.5 bg-card/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
    onClick={() => onViewDetails?.(drive)}
  >
    <div className="min-w-0 space-y-0.5">
      <p className="font-medium text-sm text-foreground truncate">
        {drive.customers?.full_name || 'Customer'}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Car className="h-3 w-3" />
          {drive.vehicles?.brand} {drive.vehicles?.model}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {drive.scheduled_date} {drive.scheduled_time?.slice(0, 5)}
        </span>
        {showAssigned && drive.assigned_sales_person?.full_name && (
          <span className="flex items-center gap-1 text-info">
            <TrendingUp className="h-3 w-3" /> {drive.assigned_sales_person.full_name}
          </span>
        )}
        {showAssigned && drive.assigned_gro?.full_name && (
          <span className="flex items-center gap-1 text-success">
            <CalendarCheck className="h-3 w-3" /> {drive.assigned_gro.full_name}
          </span>
        )}
      </div>
    </div>
    <Badge className={`text-xs shrink-0 border ${STATUS_COLOR[drive.status] || 'bg-muted text-muted-foreground'}`}>
      {formatStatus(drive.status)}
    </Badge>
  </div>
);

export default BranchAdminDashboard;
