import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDealerContext } from '@/hooks/useDealerContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(220,80%,50%)', 'hsl(145,65%,42%)', 'hsl(38,95%,55%)', 'hsl(0,75%,55%)', 'hsl(200,80%,50%)'];

const DataCenterPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [statusData, setStatusData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [vehicleData, setVehicleData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const { dealerId, dealerLocationIds, loading: dealerLoading } = useDealerContext();

  useEffect(() => {
    if (!dealerLoading && dealerId) {
      supabase.from('locations').select('*').eq('dealer_id', dealerId).then(({ data }) => setLocations(data || []));
    }
  }, [dealerId, dealerLoading]);

  useEffect(() => {
    if (!dealerLoading) fetchAnalytics();
  }, [selectedLocation, dealerLocationIds, dealerLoading]);

  const fetchAnalytics = async () => {
    let query = supabase.from('test_drives').select('*, vehicles(brand, model), locations(name)');
    if (selectedLocation !== 'all') {
      query = query.eq('location_id', selectedLocation);
    } else if (dealerLocationIds && dealerLocationIds.length > 0) {
      query = query.in('location_id', dealerLocationIds);
    }
    const { data: testDrives } = await query;
    if (!testDrives) return;

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
      const name = `${td.vehicles?.brand} ${td.vehicles?.model}`;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Data Center</h1>
            <p className="text-muted-foreground">Analytics and insights for your dealership</p>
          </div>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
