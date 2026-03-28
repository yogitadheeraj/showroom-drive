import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Clock, TrendingUp, Monitor, ShieldAlert, Car } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GROCalendarView from './GROCalendarView';
import BlockedSlotsManager from './BlockedSlotsManager';

const GRODashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ today: 0, upcoming: 0, completed: 0 });
  const [testDrives, setTestDrives] = useState<any[]>([]);

  useEffect(() => {
    fetchTestDrives();
  }, [profile]);

  const fetchTestDrives = async () => {
    if (!profile?.location_id) return;
    const { data } = await supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .eq('location_id', profile.location_id)
      .order('scheduled_date', { ascending: true });
    setTestDrives(data || []);
    const today = new Date().toISOString().split('T')[0];
    setStats({
      today: (data || []).filter(t => t.scheduled_date === today).length,
      upcoming: (data || []).filter(t => t.status === 'scheduled' || t.status === 'confirmed').length,
      completed: (data || []).filter(t => t.status === 'completed').length,
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

  const waitingBoardUrl = profile?.location_id
    ? `/waiting-board?location=${profile.location_id}`
    : '/waiting-board';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">GRO Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage test drive appointments</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto" onClick={() => window.open(waitingBoardUrl, '_blank')}>
          <Monitor className="h-4 w-4 mr-2" /> Waiting Board
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Today's Drives", value: stats.today, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-card h-full min-w-0">
              <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-h-[88px] sm:min-h-[96px]">
                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-heading font-bold leading-none text-foreground">{stat.value}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight break-words mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
          <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendar</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs sm:text-sm">Queue</TabsTrigger>
          <TabsTrigger value="blocked" className="text-xs sm:text-sm">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Blocked
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <GROCalendarView />
        </TabsContent>

        <TabsContent value="queue">
          <Card className="shadow-card">
            <CardContent className="pt-4 sm:pt-6">
              <div className="space-y-3">
                {testDrives.map(td => (
                  <div key={td.id} className="p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground text-sm sm:text-base">{td.customers?.full_name}</p>
                          <Badge variant="secondary" className={`text-xs ${statusColor[td.status] || ''}`}>
                            {td.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-xs">{td.source}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                          <Car className="h-3 w-3" />
                          <span>{td.vehicles?.brand} {td.vehicles?.model}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{td.scheduled_date} {td.scheduled_time}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {td.status === 'scheduled' && (
                          <>
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => updateStatus(td.id, 'confirmed')}>Confirm</Button>
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                            <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => updateStatus(td.id, 'no_show')}>No Show</Button>
                          </>
                        )}
                        {td.status === 'confirmed' && (
                          <>
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                            <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => updateStatus(td.id, 'no_show')}>No Show</Button>
                          </>
                        )}
                        {td.status === 'show' && (
                          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={() => updateStatus(td.id, 'in_progress')}>Start Drive</Button>
                        )}
                        {td.status === 'in_progress' && (
                          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'completed')}>Complete</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {testDrives.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No test drives scheduled</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <BlockedSlotsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GRODashboard;
