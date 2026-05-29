import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiDbQuery } from '@/lib/apiClient';
import { sendTransactionalEmail } from '@/lib/functionService';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { CalendarX, RefreshCw, Car, Clock, MapPin, User, Phone, Route } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import { TestDriveJourneyDialog } from '@/components/TestDriveJourneyDialog';

type DurationBadge = 'Lightning Fast' | 'Smooth Experience' | 'Detailed Guidance' | 'Premium Attention';

const getDurationMinutes = (td: any): number | null => {
  const start = td?.security_checked_in_at || td?.started_at;
  const end = td?.security_checked_out_at || td?.completed_at;
  if (!start || !end) return null;

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
};

const getDurationBadge = (durationMinutes: number | null): DurationBadge | null => {
  if (durationMinutes === null) return null;
  if (durationMinutes <= 30) return 'Lightning Fast';
  if (durationMinutes <= 60) return 'Smooth Experience';
  if (durationMinutes <= 90) return 'Detailed Guidance';
  return 'Premium Attention';
};

const durationBadgeClass: Record<DurationBadge, string> = {
  'Lightning Fast': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Smooth Experience': 'bg-blue-100 text-blue-700 border-blue-300',
  'Detailed Guidance': 'bg-amber-100 text-amber-700 border-amber-300',
  'Premium Attention': 'bg-violet-100 text-violet-700 border-violet-300',
};

type LeadTemperature = 'hot' | 'cold';

const TestDrivesPage = () => {
  const { role, profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [journeyDrive, setJourneyDrive] = useState<any | null>(null);
  const [leadDialogDrive, setLeadDialogDrive] = useState<any | null>(null);
  const [leadTemperature, setLeadTemperature] = useState<LeadTemperature>('cold');
  const [followUpTaskTitle, setFollowUpTaskTitle] = useState('');
  const [followUpTaskDueAt, setFollowUpTaskDueAt] = useState('');
  const { toast } = useToast();
  const { dealerLocationIds, loading: dealerLoading } = useDealerContext();
  const canCreateOpportunity = role === APP_ROLE.SALES || role === APP_ROLE.SUPERADMIN || role === APP_ROLE.DEALER_ADMIN;

  useEffect(() => {
    if (!dealerLoading) fetchTestDrives();
  }, [statusFilter, dealerLocationIds, dealerLoading]);

  const fetchTestDrives = async () => {
    const filters: Array<{ field: string; op: 'eq' | 'in'; value: unknown }> = [];

    if (role === APP_ROLE.SALES) {
      if (!profile?.id) {
        setTestDrives([]);
        return;
      }
      filters.push({ field: 'assigned_sales_person_id', op: 'eq', value: profile.id });
    }

    if (statusFilter !== 'all') {
      filters.push({ field: 'status', op: 'eq', value: statusFilter });
    }

    if (role !== APP_ROLE.SUPERADMIN && dealerLocationIds && dealerLocationIds.length > 0) {
      filters.push({ field: 'location_id', op: 'in', value: dealerLocationIds });
    }

    const drives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: '*',
      filters,
      order: [
        { field: 'scheduled_date', ascending: false },
        { field: 'scheduled_time', ascending: true },
      ],
    });

    const customerIds = Array.from(new Set(drives.map((d) => d.customer_id).filter(Boolean)));
    const vehicleIds = Array.from(new Set(drives.map((d) => d.vehicle_id).filter(Boolean)));
    const locationIds = Array.from(new Set(drives.map((d) => d.location_id).filter(Boolean)));
    const profileIds = Array.from(new Set(drives.map((d) => d.assigned_sales_person_id).filter(Boolean)));

    const [customers, vehicles, locations, profiles] = await Promise.all([
      customerIds.length
        ? apiDbQuery<any[]>({ table: 'customers', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: customerIds }] })
        : Promise.resolve([]),
      vehicleIds.length
        ? apiDbQuery<any[]>({ table: 'vehicles', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: vehicleIds }] })
        : Promise.resolve([]),
      locationIds.length
        ? apiDbQuery<any[]>({ table: 'locations', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: locationIds }] })
        : Promise.resolve([]),
      profileIds.length
        ? apiDbQuery<any[]>({ table: 'profiles', action: 'select', select: 'id, full_name', filters: [{ field: 'id', op: 'in', value: profileIds }] })
        : Promise.resolve([]),
    ]);
console.log({ drives, customers, vehicles, locations, profiles });
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    setTestDrives(
      drives.map((d) => ({
        ...d,
        customers: customerMap.get(d.customer_id) || null,
        vehicles: vehicleMap.get(d.vehicle_id) || null,
        locations: locationMap.get(d.location_id) || null,
        profiles: profileMap.get(d.assigned_sales_person_id) || null,
      })),
    );
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newTime) return;
    const original = testDrives.find((t) => t.id === rescheduleId);
    if (!original) return;

    const [newDrive] = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'insert',
      values: [{
      customer_id: original.customer_id,
      vehicle_id: original.vehicle_id,
      location_id: original.location_id,
      assigned_sales_person_id: original.assigned_sales_person_id,
      assigned_gro_id: original.assigned_gro_id,
      scheduled_date: newDate,
      scheduled_time: newTime,
      source: original.source,
      rescheduled_from: rescheduleId,
      }],
    });

    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: { status: 'rescheduled' },
      filters: [{ field: 'id', op: 'eq', value: rescheduleId }],
    });

    // Send reschedule email to customer
    if (original.customers?.email) {
      await sendTransactionalEmail({
          templateName: 'test-drive-rescheduled',
          recipientEmail: original.customers.email,
          idempotencyKey: `td-rescheduled-${newDrive?.id || rescheduleId}`,
          templateData: {
            customerName: original.customers.full_name || '',
            vehicleName: `${original.vehicles?.brand || ''} ${original.vehicles?.model || ''}`.trim(),
            locationName: original.locations?.name || '',
            newDate,
            newTime,
            originalDate: original.scheduled_date,
            originalTime: original.scheduled_time,
          },
      });
    }

    toast({ title: 'Test drive rescheduled' });
    setRescheduleId(null);
    setNewDate('');
    setNewTime('');
    fetchTestDrives();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    const original = testDrives.find((t) => t.id === cancelId);

    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: {
        status: 'cancelled',
        cancelled_reason: cancelReason,
      },
      filters: [{ field: 'id', op: 'eq', value: cancelId }],
    });

    // Send cancel email to customer
    if (original?.customers?.email) {
      await sendTransactionalEmail({
          templateName: 'test-drive-cancelled',
          recipientEmail: original.customers.email,
          idempotencyKey: `td-cancelled-${cancelId}`,
          templateData: {
            customerName: original.customers.full_name || '',
            vehicleName: `${original.vehicles?.brand || ''} ${original.vehicles?.model || ''}`.trim(),
            locationName: original.locations?.name || '',
            scheduledDate: original.scheduled_date,
            scheduledTime: original.scheduled_time,
            cancelReason: cancelReason || undefined,
          },
      });
    }

    toast({ title: 'Test drive cancelled' });
    setCancelId(null);
    setCancelReason('');
    fetchTestDrives();
  };

  const handleCreateOpportunity = async () => {
    if (!leadDialogDrive?.customer_id || !profile?.id) return;

    try {
      const stage = leadTemperature === 'hot' ? 'qualified' : 'new';
      const statusNote = `[${new Date().toLocaleString()}] Lead marked ${leadTemperature.toUpperCase()} from Test Drives page.`;

      const existingOpportunities = await apiDbQuery<any[]>({
        table: 'sales_opportunities',
        action: 'select',
        select: 'id, notes',
        filters: [
          { field: 'customer_id', op: 'eq', value: leadDialogDrive.customer_id },
          { field: 'owner_profile_id', op: 'eq', value: profile.id },
          { field: 'location_id', op: 'eq', value: leadDialogDrive.location_id },
          { field: 'stage', op: 'not_in', value: ['won', 'lost'] },
        ],
        order: [{ field: 'updated_at', ascending: false }],
        limit: 1,
      });
      const existingOpportunity = existingOpportunities?.[0] || null;

      let opportunityId = '';
      if (existingOpportunity?.id) {
        await apiDbQuery({
          table: 'sales_opportunities',
          action: 'update',
          payload: {
            latest_test_drive_id: leadDialogDrive.id,
            temperature: leadTemperature,
            stage,
            notes: `${existingOpportunity.notes || ''}\n${statusNote}`.trim(),
            updated_at: new Date().toISOString(),
          },
          filters: [{ field: 'id', op: 'eq', value: existingOpportunity.id }],
        });
        opportunityId = existingOpportunity.id;
      } else {
        const createdOpportunityRows = await apiDbQuery<any[]>({
          table: 'sales_opportunities',
          action: 'insert',
          values: [{
            customer_id: leadDialogDrive.customer_id,
            latest_test_drive_id: leadDialogDrive.id,
            location_id: leadDialogDrive.location_id,
            owner_profile_id: profile.id,
            temperature: leadTemperature,
            stage,
            notes: statusNote,
          }],
        });
        const createdOpportunity = createdOpportunityRows?.[0] || null;

        if (!createdOpportunity?.id) throw new Error('Unable to create opportunity');
        opportunityId = createdOpportunity.id;
      }

      const taskTitle = (followUpTaskTitle || '').trim() || (leadTemperature === 'hot'
        ? 'Call customer for booking amount and finance options'
        : 'Follow up after test drive and capture objections');

      const dueAt = followUpTaskDueAt
        ? new Date(followUpTaskDueAt).toISOString()
        : new Date(Date.now() + (leadTemperature === 'hot' ? 24 : 72) * 60 * 60 * 1000).toISOString();

      const insertedTasks = await apiDbQuery<any[]>({
        table: 'sales_tasks',
        action: 'insert',
        values: [{
          opportunity_id: opportunityId,
          test_drive_id: leadDialogDrive.id,
          customer_id: leadDialogDrive.customer_id,
          assigned_to_profile_id: profile.id,
          title: taskTitle,
          due_at: dueAt,
          status: 'open',
          priority: leadTemperature === 'hot' ? 'high' : 'medium',
        }],
      });

      if (!insertedTasks?.length) throw new Error('Unable to create follow-up task');

      toast({ title: 'Opportunity created', description: 'Lead and follow-up task saved successfully.' });
      setLeadDialogDrive(null);
      setLeadTemperature('cold');
      setFollowUpTaskTitle('');
      setFollowUpTaskDueAt('');
    } catch (error: any) {
      toast({ title: 'Failed to create opportunity', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
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
            <p className="text-sm text-muted-foreground">Manage all test drive appointments and journey completion quality</p>
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

        <Card className="shadow-card hidden lg:block">
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
                    <th className="text-left p-3 text-muted-foreground font-medium">Journey Time</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Sales Person</th>
                     <th className="text-left p-3 text-muted-foreground font-medium">Created On</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                {console.log(testDrives)}
                <tbody>
                  {testDrives.map((td) => {
                    const durationMinutes = getDurationMinutes(td);
                    const journeyBadge = getDurationBadge(durationMinutes);

                    return (
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
                        <td className="p-3">
                          {durationMinutes !== null ? (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">{durationMinutes} mins</p>
                              {journeyBadge && (
                                <Badge variant="secondary" className={`text-xs ${durationBadgeClass[journeyBadge]}`}>
                                  {journeyBadge}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Not completed yet</p>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{td.profiles?.full_name || '-'}</td>
                           <td className="p-3 text-muted-foreground">{td.created_at ? new Date(td.created_at).toLocaleString() : '-'}</td>
                     
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary/40 text-primary hover:bg-primary/10"
                              title="View Test Drive Journey"
                              onClick={() => setJourneyDrive(td)}
                            >
                              <Route className="h-3 w-3" />
                            </Button>
                            {['scheduled', 'confirmed'].includes(td.status) && (
                              <>
                                <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90" onClick={() => setRescheduleId(td.id)}>
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setCancelId(td.id)}>
                                  <CalendarX className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {canCreateOpportunity && ['completed', 'key_handover_to_sales'].includes(td.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-warning/40 text-warning hover:bg-warning/10"
                                title="Create Opportunity"
                                onClick={() => {
                                  setLeadDialogDrive(td);
                                  setLeadTemperature('cold');
                                  setFollowUpTaskTitle('');
                                  setFollowUpTaskDueAt('');
                                }}
                              >
                                Create Lead
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {testDrives.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No test drives found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="lg:hidden space-y-3">
          {testDrives.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-8 text-center text-muted-foreground">No test drives found</CardContent>
            </Card>
          ) : (
            testDrives.map((td) => {
              const durationMinutes = getDurationMinutes(td);
              const journeyBadge = getDurationBadge(durationMinutes);

              return (
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

                    <div className="flex flex-wrap items-center gap-2">
                      {durationMinutes !== null ? (
                        <>
                          <Badge variant="outline">{durationMinutes} mins</Badge>
                          {journeyBadge && <Badge variant="secondary" className={durationBadgeClass[journeyBadge]}>{journeyBadge}</Badge>}
                        </>
                      ) : (
                        <Badge variant="outline">Not completed yet</Badge>
                      )}
                    </div>

                    {td.profiles?.full_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        Sales: {td.profiles.full_name}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button size="sm" variant="outline" className="flex-1 border-primary/40 text-primary hover:bg-primary/10" onClick={() => setJourneyDrive(td)}>
                        <Route className="h-3.5 w-3.5 mr-1.5" /> View Journey
                      </Button>
                      {['scheduled', 'confirmed'].includes(td.status) && (
                        <>
                          <Button size="sm" className="flex-1 bg-info text-info-foreground hover:bg-info/90" onClick={() => setRescheduleId(td.id)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reschedule
                          </Button>
                          <Button size="sm" className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setCancelId(td.id)}>
                            <CalendarX className="h-3.5 w-3.5 mr-1.5" /> Cancel
                          </Button>
                        </>
                      )}
                      {canCreateOpportunity && ['completed', 'key_handover_to_sales'].includes(td.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-warning/40 text-warning hover:bg-warning/10"
                          onClick={() => {
                            setLeadDialogDrive(td);
                            setLeadTemperature('cold');
                            setFollowUpTaskTitle('');
                            setFollowUpTaskDueAt('');
                          }}
                        >
                          Create Lead
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Dialog open={!!rescheduleId} onOpenChange={(open) => !open && setRescheduleId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Reschedule Test Drive</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Date</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New Time</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
              <Button onClick={handleReschedule} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Confirm Reschedule</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Cancel Test Drive</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason for cancellation</Label>
                <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional reason..." />
              </div>
              <Button onClick={handleCancel} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Cancellation</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!leadDialogDrive} onOpenChange={(open) => !open && setLeadDialogDrive(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Create Opportunity + Task</DialogTitle>
              <DialogDescription>
                {leadDialogDrive?.customers?.full_name} • {leadDialogDrive?.vehicles?.brand} {leadDialogDrive?.vehicles?.model}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lead Temperature</Label>
                <Select value={leadTemperature} onValueChange={(value: LeadTemperature) => setLeadTemperature(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead temperature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">Hot Lead (ready to buy)</SelectItem>
                    <SelectItem value="cold">Cold Lead (follow up later)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Follow-up Task</Label>
                <Input
                  value={followUpTaskTitle}
                  onChange={(e) => setFollowUpTaskTitle(e.target.value)}
                  placeholder={leadTemperature === 'hot'
                    ? 'Call customer for booking amount and finance options'
                    : 'Follow up after test drive and capture objections'}
                />
              </div>
              <div className="space-y-2">
                <Label>Task Due At</Label>
                <Input type="datetime-local" value={followUpTaskDueAt} onChange={(e) => setFollowUpTaskDueAt(e.target.value)} />
              </div>
              <Button onClick={handleCreateOpportunity} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Save Opportunity + Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <TestDriveJourneyDialog
          testDrive={journeyDrive}
          open={!!journeyDrive}
          onClose={() => setJourneyDrive(null)}
        />
      </div>
    </DashboardLayout>
  );
};

export default TestDrivesPage;
