import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { CalendarX, RefreshCw, Car, Clock, MapPin, User, Phone } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';

const TestDrivesPage = () => {
  const { role, profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [securityLogsByDrive, setSecurityLogsByDrive] = useState<Record<string, any[]>>({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const { toast } = useToast();
  const { dealerLocationIds, loading: dealerLoading } = useDealerContext();

  useEffect(() => {
    if (!dealerLoading) fetchTestDrives();
  }, [statusFilter, dealerLocationIds, dealerLoading]);

  const fetchTestDrives = async () => {
    let query = supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*), profiles!test_drives_assigned_sales_person_id_fkey(full_name)')
      .order('scheduled_date', { ascending: false });

    if (role === APP_ROLE.SALES) {
      if (!profile?.id) {
        setTestDrives([]);
        return;
      }
      query = query.eq('assigned_sales_person_id', profile.id);
    }

    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
    if (role !== APP_ROLE.SUPERADMIN && dealerLocationIds && dealerLocationIds.length > 0) {
      query = query.in('location_id', dealerLocationIds);
    }
    const { data } = await query;
    const drives = data || [];
    setTestDrives(drives);

    if (!drives.length) {
      setSecurityLogsByDrive({});
      return;
    }

    const driveIds = new Set(drives.map((d) => d.id));
    const { data: securityEvents } = await supabase
      .from('staff_activity_events')
      .select('event_type, event_label, happened_at, metadata, profiles:profile_id(full_name)')
      .eq('role', 'security')
      .in('event_type', [
        'test_drive_check_in',
        'test_drive_check_out',
        'test_drive_completed',
        'vehicle_inspection_pre',
        'vehicle_inspection_post',
        'license_verified',
      ])
      .order('happened_at', { ascending: false })
      .limit(1500);

    const logsByDrive: Record<string, any[]> = {};
    for (const event of securityEvents || []) {
      const testDriveId = (event as any)?.metadata?.testDriveId;
      if (!testDriveId || !driveIds.has(testDriveId)) continue;
      if (!logsByDrive[testDriveId]) logsByDrive[testDriveId] = [];

      logsByDrive[testDriveId].push({
        eventType: (event as any).event_type,
        label: (event as any).event_label || (event as any).event_type,
        happenedAt: (event as any).happened_at,
        by: (event as any)?.profiles?.full_name || 'Security',
      });
    }

    setSecurityLogsByDrive(logsByDrive);
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newTime) return;
    const original = testDrives.find(t => t.id === rescheduleId);
    if (!original) return;

    await supabase.from('test_drives').insert({
      customer_id: original.customer_id,
      vehicle_id: original.vehicle_id,
      location_id: original.location_id,
      assigned_sales_person_id: original.assigned_sales_person_id,
      assigned_gro_id: original.assigned_gro_id,
      scheduled_date: newDate,
      scheduled_time: newTime,
      source: original.source,
      rescheduled_from: rescheduleId,
    });

    await supabase.from('test_drives').update({ status: 'rescheduled' as any }).eq('id', rescheduleId);

    toast({ title: 'Test drive rescheduled' });
    setRescheduleId(null);
    setNewDate('');
    setNewTime('');
    fetchTestDrives();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    await supabase.from('test_drives').update({
      status: 'cancelled' as any,
      cancelled_reason: cancelReason,
    }).eq('id', cancelId);

    toast({ title: 'Test drive cancelled' });
    setCancelId(null);
    setCancelReason('');
    fetchTestDrives();
  };

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info border-info/20',
    confirmed: 'bg-primary/10 text-primary border-primary/20',
    show: 'bg-success/10 text-success border-success/20',
    no_show: 'bg-warning/10 text-warning border-warning/20',
    in_progress: 'bg-accent/10 text-accent-foreground border-accent/20',
    completed: 'bg-success/10 text-success border-success/20',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
    rescheduled: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Test Drives</h1>
            <p className="text-sm text-muted-foreground">Manage all test drive appointments</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Legacy table intentionally hidden in favor of card records */}
        <Card className="hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-muted-foreground font-medium">Customer</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Vehicle</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Location</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Date & Time</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Sales Person</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testDrives.map(td => (
                    <tr key={td.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{td.customers?.phone}</p>
                      </td>
                      <td className="p-3 text-foreground">{td.vehicles?.brand} {td.vehicles?.model}</td>
                      <td className="p-3 text-muted-foreground">{td.locations?.name}</td>
                      <td className="p-3 text-muted-foreground">{td.scheduled_date}<br />{td.scheduled_time}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className={statusColor[td.status]}>{td.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{td.profiles?.full_name || '-'}</td>
                      <td className="p-3">
                        {['scheduled', 'confirmed'].includes(td.status) && (
                          <div className="flex gap-1">
                            <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90" onClick={() => { setRescheduleId(td.id); }}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setCancelId(td.id)}>
                              <CalendarX className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {testDrives.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No test drives found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Card Records */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {testDrives.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-8 text-center text-muted-foreground">No test drives found</CardContent>
            </Card>
          ) : testDrives.map(td => (
            <Card key={td.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading font-semibold text-foreground">{td.customers?.full_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />
                      {td.customers?.phone}
                    </div>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${statusColor[td.status]}`}>
                    {td.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground font-medium truncate">{td.vehicles?.brand} {td.vehicles?.model}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{td.locations?.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{td.scheduled_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{td.scheduled_time}</span>
                  </div>
                </div>

                {td.profiles?.full_name && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    Sales: {td.profiles.full_name}
                  </div>
                )}

                {td.status === 'completed' && (
                  <div className="rounded-md border border-success/30 bg-success/5 p-2.5 space-y-2 text-xs">
                    <p className="font-semibold text-foreground">Completed Drive Details</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Pre KM:</span> <span className="font-medium">{(td as any).pre_drive_km ?? 'N/A'}</span></div>
                      <div><span className="text-muted-foreground">Pre Fuel:</span> <span className="font-medium">{(td as any).pre_drive_fuel_level || 'N/A'}</span></div>
                      <div><span className="text-muted-foreground">Post KM:</span> <span className="font-medium">{(td as any).post_drive_km ?? 'N/A'}</span></div>
                      <div><span className="text-muted-foreground">Post Fuel:</span> <span className="font-medium">{(td as any).post_drive_fuel_level || 'N/A'}</span></div>
                    </div>
                    {(td as any).pre_drive_km && (td as any).post_drive_km && (
                      <div><span className="text-muted-foreground">Distance:</span> <span className="font-medium">{((td as any).post_drive_km - (td as any).pre_drive_km).toFixed(1)} km</span></div>
                    )}
                    <div className="pt-1 border-t border-border/60 space-y-1">
                      <p className="text-muted-foreground font-medium">Security Logs</p>
                      {(securityLogsByDrive[td.id]?.length ?? 0) > 0 ? (
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {securityLogsByDrive[td.id].map((log: any, idx: number) => (
                            <div key={`${log.eventType}-${log.happenedAt}-${idx}`} className="rounded border border-border/60 bg-background/70 p-1.5">
                              <p className="text-foreground leading-tight">{log.label}</p>
                              <p className="text-muted-foreground">{log.by} • {new Date(log.happenedAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No security logs available.</p>
                      )}
                    </div>
                  </div>
                )}

                {['scheduled', 'confirmed'].includes(td.status) && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button size="sm" className="flex-1 bg-info text-info-foreground hover:bg-info/90" onClick={() => { setRescheduleId(td.id); }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reschedule
                    </Button>
                    <Button size="sm" className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setCancelId(td.id)}>
                      <CalendarX className="h-3.5 w-3.5 mr-1.5" /> Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={!!rescheduleId} onOpenChange={(o) => !o && setRescheduleId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Reschedule Test Drive</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Date</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New Time</Label>
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
              </div>
              <Button onClick={handleReschedule} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Confirm Reschedule</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Cancel Test Drive</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason for cancellation</Label>
                <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Optional reason..." />
              </div>
              <Button onClick={handleCancel} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Cancellation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TestDrivesPage;
