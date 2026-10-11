import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Users, Wrench, CheckCircle2, Clock3 } from 'lucide-react';

const COLORS = ['hsl(220,80%,50%)', 'hsl(145,65%,42%)', 'hsl(38,95%,55%)', 'hsl(0,75%,55%)', 'hsl(200,80%,50%)'];

const toTitle = (value: string) =>
  String(value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());

const DataCenterPage = () => {
  const { user, loading } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [statusData, setStatusData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [vehicleData, setVehicleData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [userRoleData, setUserRoleData] = useState<any[]>([]);
  const [serviceStatusData, setServiceStatusData] = useState<any[]>([]);
  const [serviceDailyData, setServiceDailyData] = useState<any[]>([]);
  const [kpi, setKpi] = useState({
    users: 0,
    serviceBookings: 0,
    serviceCompletedRate: 0,
    pendingService: 0,
  });

  useEffect(() => {
    if (loading || !user) return;

    apiGet<any[]>('/api/locations')
      .then((data) => setLocations(data || []))
      .catch(() => setLocations([]));
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    fetchAnalytics();
  }, [selectedLocation, loading, user]);

  const fetchAnalytics = async () => {
    const filters: Array<{ field: string; op: 'eq' | 'in'; value: unknown }> = [];
    if (selectedLocation !== 'all') {
      filters.push({ field: 'location_id', op: 'eq', value: selectedLocation });
    }

    try {
      const [testDrives, serviceBookings, profiles, userRoles] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'test_drives',
          action: 'select',
          select: '*',
          filters,
        }),
        apiDbQuery<any[]>({
          table: 'service_appointments',
          action: 'select',
          select: 'id, status, appointment_date, service_date, created_at, location_id',
          filters,
        }),
        apiDbQuery<any[]>({
          table: 'profiles',
          action: 'select',
          select: 'id, user_id, location_id',
          filters,
        }),
        apiDbQuery<any[]>({
          table: 'user_roles',
          action: 'select',
          select: 'user_id, role',
        }),
      ]);

      const driveRows = testDrives || [];
      const serviceRows = serviceBookings || [];
      const profileRows = profiles || [];
      const roleRows = userRoles || [];

      const vehicleIds = Array.from(new Set(driveRows.map((td) => td.vehicle_id).filter(Boolean)));
      const vehicles = vehicleIds.length
        ? await apiDbQuery<any[]>({
            table: 'vehicles',
            action: 'select',
            select: 'id, brand, model',
            filters: [{ field: 'id', op: 'in', value: vehicleIds }],
          })
        : [];
      const vehicleMap = new Map((vehicles || []).map((vehicle) => [vehicle.id, vehicle]));

      const statusCounts: Record<string, number> = {};
      driveRows.forEach((td) => {
        statusCounts[td.status] = (statusCounts[td.status] || 0) + 1;
      });
      setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name: toTitle(name), value })));

      const dailyCounts: Record<string, number> = {};
      driveRows.forEach((td) => {
        const key = td.scheduled_date || td.created_at?.slice?.(0, 10);
        if (!key) return;
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      });
      setDailyData(Object.entries(dailyCounts).sort().slice(-14).map(([date, count]) => ({ date, count })));

      const vehicleCounts: Record<string, number> = {};
      driveRows.forEach((td) => {
        const vehicle = vehicleMap.get(td.vehicle_id);
        const name = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Unknown Vehicle';
        vehicleCounts[name] = (vehicleCounts[name] || 0) + 1;
      });
      setVehicleData(Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })));

      const sourceCounts: Record<string, number> = {};
      driveRows.forEach((td) => {
        const source = td.source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      setSourceData(Object.entries(sourceCounts).map(([name, value]) => ({ name: toTitle(name), value })));

      const roleByUser = new Map(roleRows.map((r) => [r.user_id, r.role]));
      const roleCounts: Record<string, number> = {};
      profileRows.forEach((profile) => {
        const role = String(roleByUser.get(profile.user_id) || 'unassigned');
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });
      setUserRoleData(
        Object.entries(roleCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name: toTitle(name), value })),
      );

      const serviceStatusCounts: Record<string, number> = {};
      const serviceDailyCounts: Record<string, number> = {};
      serviceRows.forEach((booking) => {
        const status = String(booking.status || 'unknown');
        serviceStatusCounts[status] = (serviceStatusCounts[status] || 0) + 1;

        const dateKey = booking.appointment_date || booking.service_date || booking.created_at?.slice?.(0, 10);
        if (!dateKey) return;
        serviceDailyCounts[dateKey] = (serviceDailyCounts[dateKey] || 0) + 1;
      });
      setServiceStatusData(Object.entries(serviceStatusCounts).map(([name, value]) => ({ name: toTitle(name), value })));
      setServiceDailyData(Object.entries(serviceDailyCounts).sort().slice(-14).map(([date, count]) => ({ date, count })));

      const completed = (serviceStatusCounts.completed || 0) + (serviceStatusCounts.delivered || 0);
      const totalService = serviceRows.length;
      const pendingService = totalService - completed;
      const completedRate = totalService > 0 ? Math.round((completed / totalService) * 100) : 0;

      setKpi({
        users: profileRows.length,
        serviceBookings: totalService,
        serviceCompletedRate: completedRate,
        pendingService: Math.max(0, pendingService),
      });
    } catch {
      setStatusData([]);
      setDailyData([]);
      setVehicleData([]);
      setSourceData([]);
      setUserRoleData([]);
      setServiceStatusData([]);
      setServiceDailyData([]);
      setKpi({ users: 0, serviceBookings: 0, serviceCompletedRate: 0, pendingService: 0 });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Data Center</h1>
            <p className="text-sm text-muted-foreground">Analytics and insights</p>
          </div>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card border-border/70">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Users</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-foreground"><Users className="h-5 w-5 text-primary" /> {kpi.users}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border/70">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Service Bookings</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-foreground"><Wrench className="h-5 w-5 text-primary" /> {kpi.serviceBookings}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border/70">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Completed Rate</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-foreground"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> {kpi.serviceCompletedRate}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border/70">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pending Service</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-foreground"><Clock3 className="h-5 w-5 text-amber-500" /> {kpi.pendingService}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Test Drive Trend (Last 14 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(220,80%,50%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Test Drive Status Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Popular Vehicles</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vehicleData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(38,95%,55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Test Drive Booking Source</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">User Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={userRoleData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(200,80%,50%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Service Booking Trend (Last 14 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={serviceDailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(145,65%,42%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Service Booking Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={serviceStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {serviceStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DataCenterPage;
