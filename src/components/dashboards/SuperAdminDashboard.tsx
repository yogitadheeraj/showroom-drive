import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { CalendarCheck, Users, Car, MapPin, TrendingUp, Clock, Filter } from 'lucide-react';

const SuperAdminDashboard = () => {
  const { role } = useAuth();
  const { dealerId: contextDealerId, loading: dealerLoading } = useDealerContext();
  const isSuperAdmin = role === 'superadmin';

  const [stats, setStats] = useState({ total: 0, scheduled: 0, completed: 0, noShow: 0, cancelled: 0 });
  const [dealers, setDealers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [repeatedCustomers, setRepeatedCustomers] = useState<any[]>([]);

  const [selectedDealer, setSelectedDealer] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');

  // For superadmin: fetch all dealers. For dealer_admin: use context dealer
  const activeDealerId = isSuperAdmin
    ? (selectedDealer === 'all' ? null : selectedDealer)
    : contextDealerId;

  // Fetch dealers (superadmin only)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchDealers = async () => {
      const { data } = await supabase.from('dealers').select('id, name').eq('is_active', true).order('name');
      setDealers(data || []);
    };
    fetchDealers();
  }, [isSuperAdmin]);

  // Fetch locations based on selected dealer
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
  }, [activeDealerId, dealerLoading, isSuperAdmin]);

  // Fetch staff based on selected location/dealer
  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchStaff = async () => {
      const locationIds = selectedLocation !== 'all'
        ? [selectedLocation]
        : locations.map(l => l.id);

      if (locationIds.length === 0) {
        setStaffMembers([]);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, location_id')
        .in('location_id', locationIds)
        .eq('is_active', true)
        .order('full_name');
      setStaffMembers(data || []);
    };
    fetchStaff();
    setSelectedStaff('all');
  }, [selectedLocation, locations, dealerLoading, isSuperAdmin]);

  // Fetch test drives data
  useEffect(() => {
    if (dealerLoading && !isSuperAdmin) return;
    const fetchData = async () => {
      const locationIds = selectedLocation !== 'all'
        ? [selectedLocation]
        : locations.map(l => l.id);

      if (locationIds.length === 0 && !isSuperAdmin) {
        setTestDrives([]);
        setStats({ total: 0, scheduled: 0, completed: 0, noShow: 0, cancelled: 0 });
        setRepeatedCustomers([]);
        return;
      }

      let query = supabase.from('test_drives').select('*, customers(*), vehicles(*), locations(*)');

      if (locationIds.length > 0) {
        query = query.in('location_id', locationIds);
      }

      if (selectedStaff !== 'all') {
        query = query.or(`assigned_gro_id.eq.${selectedStaff},assigned_sales_person_id.eq.${selectedStaff}`);
      }

      const { data: td } = await query.order('scheduled_date', { ascending: false }).limit(500);
      setTestDrives(td || []);

      const total = td?.length || 0;
      const scheduled = td?.filter(t => t.status === 'scheduled').length || 0;
      const completed = td?.filter(t => t.status === 'completed').length || 0;
      const noShow = td?.filter(t => t.status === 'no_show').length || 0;
      const cancelled = td?.filter(t => t.status === 'cancelled').length || 0;
      setStats({ total, scheduled, completed, noShow, cancelled });

      const customerIds = [...new Set(td?.map(t => t.customer_id) || [])];
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from('customers').select('*')
          .gt('total_test_drives', 1)
          .in('id', customerIds);
        setRepeatedCustomers(customers || []);
      } else {
        setRepeatedCustomers([]);
      }
    };
    fetchData();
  }, [selectedLocation, selectedStaff, locations, dealerLoading, isSuperAdmin]);

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
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {isSuperAdmin ? 'Super Admin Dashboard' : 'Sales Lead Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? 'Overview of all dealerships, locations and test drives' : 'Overview of your dealership locations and test drives'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground mr-1">Filters:</span>

          {isSuperAdmin && (
            <Select value={selectedDealer} onValueChange={(v) => { setSelectedDealer(v); }}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="All Dealers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {dealers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffMembers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
