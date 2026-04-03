import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarCheck, Users, Car, TrendingUp, Clock, ShieldCheck,
  CheckCircle2, AlertCircle, Eye, Filter, LayoutDashboard, MapPin,
} from 'lucide-react';
import { APP_ROLE, APP_ROLE_LABELS, APP_ROLE_BADGE_CLASS } from '@/constants/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    fetchAll();
  }, [locationId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Location info
      const { data: loc } = await supabase
        .from('locations')
        .select('id, name, address')
        .eq('id', locationId)
        .maybeSingle();
      setLocationInfo(loc);

      // All staff at this location
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone, is_active')
        .eq('location_id', locationId)
        .order('full_name');

      const profileList = profiles || [];
      const userIds = profileList.map(p => p.user_id).filter(Boolean);

      let rolesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        (roleRows || []).forEach(r => { rolesMap[r.user_id] = r.role; });
      }

      const enrichedStaff = profileList.map(p => ({
        ...p,
        role: rolesMap[p.user_id] || null,
      }));
      setStaff(enrichedStaff);

      // All test drives for this location
      const { data: drives } = await supabase
        .from('test_drives')
        .select('*, customers(*), vehicles(*), profiles!assigned_sales_person_id(id, full_name), gro_profile:profiles!gro_id(id, full_name)')
        .eq('location_id', locationId)
        .order('scheduled_date', { ascending: false })
        .limit(300);
      setAllDrives(drives || []);
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

  // Drives per sales person
  const salesPersonStats = salesStaff.map(s => {
    const myDrives = allDrives.filter(d => d.profiles?.id === s.id);
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
    const myDrives = allDrives.filter(d => d.gro_profile?.id === g.id);
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

  // Chart: sales bar chart (assigned drives per person)
  const salesBarData = salesPersonStats.map(s => ({
    name: s.full_name?.split(' ')[0] || 'Sales',
    Completed: s.completed,
    Active: s.active,
  }));

  // Filtered drives for the drives table
  const filteredDrives = allDrives.filter(d => {
    const roleMatch = selectedRole === 'all'
      || (selectedRole === 'sales' && d.profiles?.id)
      || (selectedRole === 'gro' && d.gro_profile?.id);
    const statusMatch = selectedStatus === 'all' || d.status === selectedStatus;
    return roleMatch && statusMatch;
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

      {/* ── Tabs ───────────────────────────────────── */}
      <Tabs defaultValue="staff-overview">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full sm:w-auto">
          <TabsTrigger value="staff-overview">Staff Overview</TabsTrigger>
          <TabsTrigger value="sales-team">Sales Team</TabsTrigger>
          <TabsTrigger value="gro-team">GRO Team</TabsTrigger>
          <TabsTrigger value="all-drives">All Drives</TabsTrigger>
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
                      d.profiles?.id === s.id || d.gro_profile?.id === s.id
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
                      <DriveRow key={d.id} drive={d} />
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
                      <DriveRow key={d.id} drive={d} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── ALL DRIVES ── */}
        <TabsContent value="all-drives" className="mt-4">
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
                    <DriveRow key={d.id} drive={d} showAssigned />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CHARTS ── */}
        <TabsContent value="charts" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-info" /> Sales Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesBarData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No sales data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={salesBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
    </div>
  );
};

// ── Shared small drive row component ─────────────────────────
interface DriveRowProps {
  drive: any;
  showAssigned?: boolean;
}

const DriveRow = ({ drive, showAssigned }: DriveRowProps) => (
  <div className="rounded-lg border border-border p-2.5 bg-card/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
        {showAssigned && drive.profiles?.full_name && (
          <span className="flex items-center gap-1 text-info">
            <TrendingUp className="h-3 w-3" /> {drive.profiles.full_name}
          </span>
        )}
        {showAssigned && drive.gro_profile?.full_name && (
          <span className="flex items-center gap-1 text-success">
            <CalendarCheck className="h-3 w-3" /> {drive.gro_profile.full_name}
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
