import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Users, Car, MapPin, TrendingUp, Clock } from 'lucide-react';

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({ total: 0, scheduled: 0, completed: 0, noShow: 0, cancelled: 0 });
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [repeatedCustomers, setRepeatedCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetchLocations();
    fetchData();
  }, [selectedLocation]);

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*').eq('is_active', true);
    setLocations(data || []);
  };

  const fetchData = async () => {
    let query = supabase.from('test_drives').select('*, customers(*), vehicles(*), locations(*)');
    if (selectedLocation !== 'all') query = query.eq('location_id', selectedLocation);
    const { data: td } = await query.order('scheduled_date', { ascending: false });
    setTestDrives(td || []);

    const total = td?.length || 0;
    const scheduled = td?.filter(t => t.status === 'scheduled').length || 0;
    const completed = td?.filter(t => t.status === 'completed').length || 0;
    const noShow = td?.filter(t => t.status === 'no_show').length || 0;
    const cancelled = td?.filter(t => t.status === 'cancelled').length || 0;
    setStats({ total, scheduled, completed, noShow, cancelled });

    const { data: customers } = await supabase.from('customers').select('*').gt('total_test_drives', 1);
    setRepeatedCustomers(customers || []);
  };

  const statCards = [
    { label: 'Total Test Drives', value: stats.total, icon: CalendarCheck, color: 'text-primary' },
    { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-info' },
    { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success' },
    { label: 'No Show', value: stats.noShow, icon: Users, color: 'text-warning' },
    { label: 'Cancelled', value: stats.cancelled, icon: Car, color: 'text-destructive' },
    { label: 'Repeat Customers', value: repeatedCustomers.length, icon: MapPin, color: 'text-accent' },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Sales Lead Dashboard</h1>
          <p className="text-muted-foreground">Overview of all locations and test drives</p>
        </div>
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">All Test Drives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                      <div>
                        <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{td.customers?.phone}</p>
                      </div>
                    </td>
                    <td className="p-3 text-foreground">{td.vehicles?.brand} {td.vehicles?.model}</td>
                    <td className="p-3 text-muted-foreground">{td.locations?.name}</td>
                    <td className="p-3 text-muted-foreground">{td.scheduled_date} {td.scheduled_time}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className={statusColor[td.status] || ''}>
                        {td.status.replace('_', ' ')}
                      </Badge>
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
        </CardContent>
      </Card>

      {repeatedCustomers.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Repeat Customers</CardTitle>
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
                      <td className="p-3">
                        <Badge className="bg-accent/10 text-accent-foreground">{c.total_test_drives}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
