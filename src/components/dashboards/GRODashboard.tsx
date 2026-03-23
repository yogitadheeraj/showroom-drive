import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Clock, Users, TrendingUp } from 'lucide-react';

const GRODashboard = () => {
  const { profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, upcoming: 0, completed: 0 });

  useEffect(() => {
    fetchTestDrives();
  }, [profile]);

  const fetchTestDrives = async () => {
    if (!profile?.location_id) {
      const { data } = await supabase.from('test_drives')
        .select('*, customers(*), vehicles(*), locations(*)')
        .order('scheduled_date', { ascending: true });
      setTestDrives(data || []);
      calcStats(data || []);
      return;
    }
    const { data } = await supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .eq('location_id', profile.location_id)
      .order('scheduled_date', { ascending: true });
    setTestDrives(data || []);
    calcStats(data || []);
  };

  const calcStats = (data: any[]) => {
    const today = new Date().toISOString().split('T')[0];
    setStats({
      today: data.filter(t => t.scheduled_date === today).length,
      upcoming: data.filter(t => t.status === 'scheduled' || t.status === 'confirmed').length,
      completed: data.filter(t => t.status === 'completed').length,
    });
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('test_drives').update({ status: status as any }).eq('id', id);
    fetchTestDrives();
  };

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info',
    confirmed: 'bg-primary/10 text-primary',
    show: 'bg-success/10 text-success',
    no_show: 'bg-warning/10 text-warning',
    in_progress: 'bg-accent/10 text-accent-foreground',
    completed: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">GRO Dashboard</h1>
        <p className="text-muted-foreground">Manage test drive appointments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Today's Drives", value: stats.today, icon: CalendarCheck, color: 'text-primary' },
          { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-info' },
          { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Test Drive Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testDrives.map(td => (
              <div key={td.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                    <Badge variant="secondary" className={statusColor[td.status] || ''}>
                      {td.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{td.source}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {td.vehicles?.brand} {td.vehicles?.model} • {td.scheduled_date} at {td.scheduled_time}
                  </p>
                </div>
                <div className="flex gap-2">
                  {td.status === 'scheduled' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(td.id, 'confirmed')}>Confirm</Button>
                      <Button size="sm" variant="outline" className="text-success" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                      <Button size="sm" variant="outline" className="text-warning" onClick={() => updateStatus(td.id, 'no_show')}>No Show</Button>
                    </>
                  )}
                  {td.status === 'confirmed' && (
                    <>
                      <Button size="sm" variant="outline" className="text-success" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                      <Button size="sm" variant="outline" className="text-warning" onClick={() => updateStatus(td.id, 'no_show')}>No Show</Button>
                    </>
                  )}
                  {td.status === 'show' && (
                    <Button size="sm" onClick={() => updateStatus(td.id, 'in_progress')}>Start Drive</Button>
                  )}
                  {td.status === 'in_progress' && (
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => updateStatus(td.id, 'completed')}>Complete</Button>
                  )}
                </div>
              </div>
            ))}
            {testDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No test drives scheduled</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GRODashboard;
