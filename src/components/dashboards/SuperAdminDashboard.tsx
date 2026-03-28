import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { CalendarCheck, Users, Car, MapPin, TrendingUp, Clock, Filter, Phone } from 'lucide-react';
import { APP_ROLE, AppRole } from '@/constants/roles';

const DASHBOARD_PREFS_KEY = 'dashboard_superadmin_prefs_v1';

const ROLE_COLORS: Record<string, string> = {
  [APP_ROLE.DEALER_ADMIN]: 'hsl(220,80%,50%)',
  [APP_ROLE.GRO]: 'hsl(145,65%,42%)',
  [APP_ROLE.SALES]: 'hsl(38,95%,55%)',
  [APP_ROLE.SECURITY]: 'hsl(0,75%,55%)',
  [APP_ROLE.SUPERADMIN]: 'hsl(200,80%,50%)',
};

const STATUS_COLORS = ['hsl(220,80%,50%)', 'hsl(145,65%,42%)', 'hsl(38,95%,55%)', 'hsl(0,75%,55%)', 'hsl(200,80%,50%)'];

const SuperAdminDashboard = () => {
  const { role } = useAuth();
  const { dealerId: contextDealerId, loading: dealerLoading } = useDealerContext();
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

  const [selectedDealer, setSelectedDealer] = useState(savedPrefs.selectedDealer || 'all');
  const [selectedLocation, setSelectedLocation] = useState(savedPrefs.selectedLocation || 'all');
  const [selectedStaff, setSelectedStaff] = useState(savedPrefs.selectedStaff || 'all');
  const [selectedRole, setSelectedRole] = useState(savedPrefs.selectedRole || 'all');
  const [testDriveView, setTestDriveView] = useState<'grid' | 'chart'>(() => (savedPrefs.testDriveView === 'chart' ? 'chart' : 'grid'));
  const [testDriveChartType, setTestDriveChartType] = useState<'pie' | 'line' | 'bar'>(() => {
    const type = savedPrefs.testDriveChartType;
    if (type === 'pie' || type === 'line' || type === 'bar') return type;
    return 'pie';
  });

  const activeDealerId = isSuperAdmin
    ? (selectedDealer === 'all' ? null : selectedDealer)
    : contextDealerId;

  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_PREFS_KEY,
      JSON.stringify({
        selectedDealer,
        selectedLocation,
        selectedStaff,
        selectedRole,
        testDriveView,
        testDriveChartType,
      })
    );
  }, [selectedDealer, selectedLocation, selectedStaff, selectedRole, testDriveView, testDriveChartType]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchDealers = async () => {
      const { data } = await supabase.from('dealers').select('id, name').eq('is_active', true).order('name');
      setDealers(data || []);
    };
    fetchDealers();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchLocations = async () => {
      let query = supabase.from('locations').select('id, name, dealer_id').eq('is_active', true);
      if (activeDealerId) query = query.eq('dealer_id', activeDealerId);
      const { data } = await query.order('name');
      setLocations(data || []);
    };
    fetchLocations();
    setSelectedLocation('all');
    setSelectedStaff('all');
    setSelectedRole('all');
  }, [activeDealerId, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchBrands = async () => {
      let query = supabase.from('brands').select('id, dealer_id').order('name');
      if (activeDealerId) query = query.eq('dealer_id', activeDealerId);
      const { data } = await query;
      setBrands(data || []);
    };
    fetchBrands();
  }, [activeDealerId, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchStaff = async () => {
      const locationIds = selectedLocation !== 'all'
        ? [selectedLocation]
        : locations.map(l => l.id);
      if (locationIds.length === 0) { setStaffMembers([]); return; }

      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, location_id, is_active')
          .in('location_id', locationIds)
          .order('full_name'),
        supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);

      const merged = (profiles || []).map((p) => {
        const roleRow = (roles || []).find((r) => r.user_id === p.user_id);
        return {
          ...p,
          role: roleRow?.role || null,
        };
      });

      setStaffMembers(merged);
    };
    fetchStaff();
    setSelectedStaff('all');
  }, [selectedLocation, locations, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchData = async () => {
      const locationIds = selectedLocation !== 'all'
        ? [selectedLocation]
        : locations.map(l => l.id);
      if (locationIds.length === 0 && !isSuperAdmin) {
        setTestDrives([]); setStats({ total: 0, scheduled: 0, completed: 0, noShow: 0, cancelled: 0 }); setRepeatedCustomers([]); return;
      }
      let query = supabase.from('test_drives').select('*, customers(*), vehicles(*), locations(*)');
      if (locationIds.length > 0) query = query.in('location_id', locationIds);
      if (selectedStaff !== 'all') query = query.or(`assigned_gro_id.eq.${selectedStaff},assigned_sales_person_id.eq.${selectedStaff}`);
      const { data: td } = await query.order('scheduled_date', { ascending: false }).limit(500);
      setTestDrives(td || []);
      const total = td?.length || 0;
      setStats({
        total,
        scheduled: td?.filter(t => t.status === 'scheduled').length || 0,
        completed: td?.filter(t => t.status === 'completed').length || 0,
        noShow: td?.filter(t => t.status === 'no_show').length || 0,
        cancelled: td?.filter(t => t.status === 'cancelled').length || 0,
      });
      const customerIds = [...new Set(td?.map(t => t.customer_id) || [])];
      if (customerIds.length > 0) {
        const { data: customers } = await supabase.from('customers').select('*').gt('total_test_drives', 1).in('id', customerIds);
        setRepeatedCustomers(customers || []);
      } else { setRepeatedCustomers([]); }
    };
    fetchData();
  }, [selectedLocation, selectedStaff, locations, dealerLoading, isSuperAdmin]);

  const filteredStaff = staffMembers.filter((s) => {
    if (selectedRole !== 'all' && s.role !== selectedRole) return false;
    return true;
  });

  const activeSalesCount = filteredStaff.filter(
    (s) => s.role === APP_ROLE.SALES && s.is_active
  ).length;

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
    { label: 'Locations', value: locationCount, icon: MapPin, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Users', value: userCount, icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Brands', value: brandCount, icon: Car, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Total Drives', value: stats.total, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
    { label: 'No Show', value: stats.noShow, icon: Users, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Cancelled', value: stats.cancelled, icon: Car, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Repeat', value: repeatedCustomers.length, icon: MapPin, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Active Sales', value: activeSalesCount, icon: Users, color: 'text-success', bg: 'bg-success/10' },
  ];

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info',
    confirmed: 'bg-primary/10 text-primary',
    show: 'bg-success/10 text-success',
    no_show: 'bg-warning/10 text-warning',
    in_progress: 'bg-accent/10 text-accent-foreground',
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
            {isSuperAdmin ? 'Super Admin Dashboard' : 'Sales Lead Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? 'Overview of all dealerships & test drives' : 'Overview of your dealership test drives'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          {isSuperAdmin && (
            <Select value={selectedDealer} onValueChange={setSelectedDealer}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Dealers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {dealers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffMembers.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value={APP_ROLE.DEALER_ADMIN}>Dealer Admin</SelectItem>
              <SelectItem value={APP_ROLE.GRO}>GRO</SelectItem>
              <SelectItem value={APP_ROLE.SALES}>Sales</SelectItem>
              <SelectItem value={APP_ROLE.SECURITY}>Security</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-heading text-lg">Test Drives</CardTitle>
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
          {testDriveView === 'chart' ? (
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
                          <Badge variant="secondary" className={statusColor[td.status] || ''}>{td.status.replace('_', ' ')}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{td.source}</Badge>
                        </td>
                      </tr>
                    ))}
                    {testDrives.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No test drives found</td></tr>
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
                        <Badge variant="secondary" className={`text-xs ${statusColor[td.status] || ''}`}>{td.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div className="flex items-center gap-1"><Car className="h-3 w-3 text-muted-foreground" /><span className="text-foreground truncate">{td.vehicles?.brand} {td.vehicles?.model}</span></div>
                        <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground truncate">{td.locations?.name}</span></div>
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">{td.scheduled_date}</span></div>
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
            <CardTitle className="font-heading text-lg">Drive Status Breakdown</CardTitle>
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
            <CardTitle className="font-heading text-lg">Staff Role Distribution</CardTitle>
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
          <CardTitle className="font-heading text-lg">Staff Activity Grid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Role</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Location</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <tr key={staff.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">{staff.full_name}</td>
                    <td className="p-3 text-muted-foreground capitalize">{staff.role || '-'}</td>
                    <td className="p-3 text-muted-foreground">
                      {locations.find((l) => l.id === staff.location_id)?.name || '-'}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={staff.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      —
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No staff found for the selected filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Repeat Customers */}
      {repeatedCustomers.length > 0 && (
        <>
          {/* Desktop */}
          <Card className="shadow-card hidden lg:block">
            <CardHeader><CardTitle className="font-heading text-lg">Repeat Customers</CardTitle></CardHeader>
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
    </div>
  );
};

export default SuperAdminDashboard;
