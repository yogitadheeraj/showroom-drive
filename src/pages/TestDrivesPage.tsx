import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { CalendarX, RefreshCw } from 'lucide-react';

const TestDrivesPage = () => {
  const { role } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
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
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
    if (dealerLocationIds && dealerLocationIds.length > 0) {
      query = query.in('location_id', dealerLocationIds);
    }
    const { data } = await query;
    setTestDrives(data || []);
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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Test Drives</h1>
            <p className="text-muted-foreground">Manage all test drive appointments</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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

        <Card className="shadow-card">
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
                            <Button size="sm" variant="ghost" onClick={() => { setRescheduleId(td.id); }}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelId(td.id)}>
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
              <Button onClick={handleReschedule} className="w-full">Confirm Reschedule</Button>
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
              <Button onClick={handleCancel} variant="destructive" className="w-full">Confirm Cancellation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TestDrivesPage;
