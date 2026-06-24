import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDealerContext } from '@/hooks/useDealerContext';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(220,80%,50%)', 'hsl(145,65%,42%)', 'hsl(38,95%,55%)', 'hsl(0,75%,55%)', 'hsl(200,80%,50%)'];

const DataCenterPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [statusData, setStatusData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [vehicleData, setVehicleData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const { organizationId, dealerId, dealerLocationIds, loading: dealerLoading } = useDealerContext();

  useEffect(() => {
    if (!dealerLoading) {
      const params = new URLSearchParams();
      const activeOrgId = organizationId || dealerId;
      if (activeOrgId) params.set('orgId', activeOrgId);
      apiGet<any[]>(`/api/v1/locations${params.toString() ? `?${params.toString()}` : ''}`)
        .then((data) => {
          const normalized = (data || []).map((loc: any) => ({
            ...loc,
            id: String(loc.id || loc._id || ''),
          }));
          setLocations(normalized.filter((loc: any) => Boolean(loc.id)));
        })
        .catch(() => setLocations([]));
    }
  }, [organizationId, dealerId, dealerLoading]);

  useEffect(() => {
    if (!dealerLoading) fetchAnalytics();
  }, [selectedLocation, dealerLocationIds, dealerLoading]);

  const fetchAnalytics = async () => {
    const filters: Array<{ field: string; op: 'eq' | 'in'; value: unknown }> = [];
    if (selectedLocation !== 'all') {
      filters.push({ field: 'location_id', op: 'eq', value: selectedLocation });
    } else if (dealerLocationIds && dealerLocationIds.length > 0) {
      filters.push({ field: 'location_id', op: 'in', value: dealerLocationIds });
    }

    const testDrives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: '*',
      filters,
    });
    if (!testDrives) return;

    const vehicleIds = Array.from(new Set(testDrives.map((td) => td.vehicle_id).filter(Boolean)));
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
    testDrives.forEach(td => {
      statusCounts[td.status] = (statusCounts[td.status] || 0) + 1;
    });
    setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value })));

    const dailyCounts: Record<string, number> = {};
    testDrives.forEach(td => {
      dailyCounts[td.scheduled_date] = (dailyCounts[td.scheduled_date] || 0) + 1;
    });
    setDailyData(Object.entries(dailyCounts).sort().slice(-14).map(([date, count]) => ({ date, count })));

    const vehicleCounts: Record<string, number> = {};
    testDrives.forEach(td => {
      const vehicle = vehicleMap.get(td.vehicle_id);
      const name = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Unknown Vehicle';
      vehicleCounts[name] = (vehicleCounts[name] || 0) + 1;
    });
    setVehicleData(Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })));

    const sourceCounts: Record<string, number> = {};
    testDrives.forEach(td => {
      sourceCounts[td.source] = (sourceCounts[td.source] || 0) + 1;
    });
    setSourceData(Object.entries(sourceCounts).map(([name, value]) => ({ name, value })));
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-heading text-lg">Daily Trend (Last 14 Days)</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="font-heading text-lg">Status Distribution</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="font-heading text-lg">Booking Source</CardTitle></CardHeader>
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DataCenterPage;
