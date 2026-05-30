import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiGet, apiPost, apiPatch, apiDbQuery } from '@/lib/apiClient';
import { sendTransactionalEmail } from '@/lib/functionService';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { CalendarX, RefreshCw, Car, Clock, MapPin, User, Phone, Route, Ban, TrendingUp, Key, FileCheck, CheckCircle2, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import { TestDriveJourneyDialog } from '@/components/TestDriveJourneyDialog';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';

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
  const [noShowId, setNoShowId] = useState<string | null>(null);
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
  const [detailSheetDrive, setDetailSheetDrive] = useState<any>(null);
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [securityActionId, setSecurityActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!dealerLoading) fetchTestDrives();
  }, [statusFilter, dealerLocationIds, dealerLoading]);

  // Real-time: auto-refresh + toast when any test drive status changes at this location
  useTestDriveRealtime(profile?.location_id, (event) => {
    const [testDriveId] = Object.keys(event);
    const eventData = event[testDriveId];
    const statusLabel = eventData.status.replace(/_/g, ' ');
      toast({
      title: 'Test Drive Updated',
      description: `Test Drive Id : - ${testDriveId} is now "${statusLabel}"`,
    });
    fetchTestDrives();
  });

  const fetchTestDrives = async () => {
    const params = new URLSearchParams();

    if (role === APP_ROLE.SALES) {
      if (!profile?.id) {
        setTestDrives([]);
        return;
      }
      params.set('sales_person_id', profile.id);
    }

    if (statusFilter !== 'all') params.set('status', statusFilter);

    if (role !== APP_ROLE.SUPERADMIN && dealerLocationIds && dealerLocationIds.length > 0) {
      params.set('location_ids', dealerLocationIds.join(','));
    }

    const drives = await apiGet<any[]>(`/api/test-drives?${params}`);
    setTestDrives(drives || []);
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newTime) return;
    const original = testDrives.find((t) => t.id === rescheduleId);
    if (!original) return;

    await apiPatch(`/api/test-drives/${encodeURIComponent(rescheduleId)}`, {
      scheduled_date: newDate,
      scheduled_time: `${newTime}:00`,
      status: 'rescheduled',
    });

    // Send reschedule email to customer
    if (original.customers?.email) {
      await sendTransactionalEmail({
          templateName: 'test-drive-rescheduled',
          recipientEmail: original.customers.email,
          idempotencyKey: `td-rescheduled-${rescheduleId}-${newDate}`,
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

    await apiPatch(`/api/test-drives/${encodeURIComponent(cancelId)}`, {
      status: 'cancelled',
      cancelled_reason: cancelReason,
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

  const updateStatus = async (id: string, newStatus: string) => {
    await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { status: newStatus });
    toast({ title: 'Status updated' });
    fetchTestDrives();
  };

  const handleAssignKey = async (id: string) => {
    setAssigningKey(id);
    try {
      await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { key_handed_at: new Date().toISOString(), status: 'in_progress' });
      toast({ title: 'Key assigned', description: 'Test drive is now in progress.' });
    } finally {
      setAssigningKey(null);
      fetchTestDrives();
    }
  };

  const handleSecurityCheckIn = async (id: string) => {
    setSecurityActionId(id);
    try {
      await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { security_checked_in_at: new Date().toISOString(), status: 'in_progress' });
      toast({ title: 'Test drive started' });
    } finally {
      setSecurityActionId(null);
      fetchTestDrives();
    }
  };

  const handleSecurityCheckOut = async (id: string) => {
    setSecurityActionId(id);
    try {
      await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { security_checked_out_at: new Date().toISOString() });
      toast({ title: 'Vehicle returned' });
    } finally {
      setSecurityActionId(null);
      fetchTestDrives();
    }
  };

  const handleKeyHandoverComplete = async (td: any) => {
    await apiPatch(`/api/test-drives/${encodeURIComponent(td.id)}`, { key_handover_completed_at: new Date().toISOString(), status: 'completed' });
    fetchTestDrives();
    setLeadDialogDrive(td);
    setLeadTemperature('cold');
    setFollowUpTaskTitle('');
    setFollowUpTaskDueAt('');
    toast({ title: 'Key handover complete', description: 'Create a follow-up opportunity below.' });
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

        {testDrives.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center text-muted-foreground">No test drives found for the selected filter</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {testDrives.map((td) => {
              const durationMinutes = getDurationMinutes(td);
              const journeyBadge = getDurationBadge(durationMinutes);

              return (
                <Card key={td.id} className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => setDetailSheetDrive(td)}>
                  <CardContent className="p-3 space-y-2.5">
                    {/* ── Header: customer + status ── */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{td.customers?.full_name}</p>
                        {td.customers?.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />{td.customers.phone}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColor[td.status]}`}>
                        {td.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    {/* ── Info grid ── */}
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 truncate"><Car className="h-3 w-3 shrink-0" />{td.vehicles?.brand} {td.vehicles?.model}</span>
                      <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{td.locations?.name}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{td.scheduled_date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{(td.scheduled_time || '').substring(0, 5)}</span>
                    </div>

                    {/* ── Sales + Duration ── */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {td.profiles?.full_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />{td.profiles.full_name}
                        </span>
                      )}
                      {journeyBadge && (
                        <Badge variant="secondary" className={`text-[10px] ${durationBadgeClass[journeyBadge]}`}>{journeyBadge}</Badge>
                      )}
                      {durationMinutes !== null && (
                        <span className="text-[10px] text-muted-foreground">{durationMinutes}m</span>
                      )}
                      {td.created_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(td.created_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="text-xs border-primary/40 text-primary hover:bg-primary/10" onClick={() => setJourneyDrive(td)}>
                        <Route className="h-3 w-3 mr-1" /> Journey
                      </Button>
                      {['scheduled', 'confirmed', 'show', 'no_show', 'rescheduled'].includes(td.status) && (
                        <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-xs" onClick={() => setRescheduleId(td.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reschedule
                        </Button>
                      )}
                      {['scheduled', 'confirmed', 'show', 'rescheduled'].includes(td.status) && (
                        <Button size="sm" variant="outline" className="text-xs border-warning/50 text-warning hover:bg-warning/10" onClick={() => setNoShowId(td.id)}>
                          <CalendarX className="h-3 w-3 mr-1" /> No Show
                        </Button>
                      )}
                      {['scheduled', 'confirmed', 'rescheduled'].includes(td.status) && (
                        <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs" onClick={() => setCancelId(td.id)}>
                          <Ban className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      )}
                      {canCreateOpportunity && ['completed', 'key_handover_to_sales'].includes(td.status) && td.scheduled_date && new Date(td.scheduled_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                        <Button size="sm" variant="outline" className="text-xs border-warning/40 text-warning hover:bg-warning/10" onClick={() => { setLeadDialogDrive(td); setLeadTemperature('cold'); setFollowUpTaskTitle(''); setFollowUpTaskDueAt(''); }}>
                          <TrendingUp className="h-3 w-3 mr-1" /> Lead
                        </Button>
                      )}
                      {/* GRO / Admin: status transitions */}
                      {([APP_ROLE.GRO, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && (
                        <>
                          {td.status === 'scheduled' && (
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => updateStatus(td.id, 'confirmed')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                            </Button>
                          )}
                          {(['scheduled', 'confirmed', 'rescheduled'] as string[]).includes(td.status) && (
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Show
                            </Button>
                          )}
                          {td.status === 'show' && (
                            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={() => updateStatus(td.id, 'in_progress')}>
                              <PlayCircle className="h-3 w-3 mr-1" /> Start Drive
                            </Button>
                          )}
                          {td.status === 'in_progress' && (
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'completed')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                            </Button>
                          )}
                        </>
                      )}
                      {/* Sales / Admin: Assign Key + Key Handover */}
                      {([APP_ROLE.SALES, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && (
                        <>
                          {(td.status === 'show' || td.status === 'scheduled'|| td.status === 'rescheduled') && !td.key_handed_at && td.customers?.driving_license_verified && (
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => handleAssignKey(td.id)} disabled={assigningKey === td.id}>
                              <Key className="h-3 w-3 mr-1" /> Assign Key
                            </Button>
                          )}
                          {td.status === 'key_handover_to_sales' && (
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => handleKeyHandoverComplete(td)}>
                              <FileCheck className="h-3 w-3 mr-1" /> Key Handover
                            </Button>
                          )}
                        </>
                      )}
                      {/* Security / Admin: Check In + Check Out */}
                      {([APP_ROLE.SECURITY, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && (
                        <>
                          {td.key_handed_at && !td.security_checked_in_at && td.customers?.driving_license_verified && (
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => handleSecurityCheckIn(td.id)} disabled={securityActionId === td.id}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Check In
                            </Button>
                          )}
                          {td.security_checked_in_at && !td.security_checked_out_at && (
                            <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => handleSecurityCheckOut(td.id)} disabled={securityActionId === td.id}>
                              <XCircle className="h-3 w-3 mr-1" /> Check Out
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <TestDriveDetailSheet
          testDrive={detailSheetDrive}
          open={!!detailSheetDrive}
          onClose={() => setDetailSheetDrive(null)}
        />

        <Dialog open={!!rescheduleId} onOpenChange={(open) => !open && setRescheduleId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Reschedule Test Drive</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Date</Label>
                <Input type="date" value={newDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New Time</Label>
                <Input type="time" value={newTime} min={newDate === new Date().toISOString().split('T')[0] ? `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}` : undefined} onChange={(e) => setNewTime(e.target.value)} />
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

        {/* No Show Confirmation Dialog */}
        <Dialog open={!!noShowId} onOpenChange={(o) => !o && setNoShowId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2 text-warning">
                Mark as No Show?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {(() => {
                const td = testDrives.find(t => t.id === noShowId);
                return td
                  ? `Are you sure you want to mark ${td.customers?.full_name || 'this customer'}'s test drive as no-show?`
                  : 'Are you sure you want to mark this test drive as no-show?';
              })()}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNoShowId(null)}>Cancel</Button>
              <Button
                className="bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={async () => {
                  if (!noShowId) return;
                  await apiPatch(`/api/test-drives/${encodeURIComponent(noShowId)}`, { status: 'no_show' });
                  setNoShowId(null);
                  fetchTestDrives();
                }}
              >
                Yes, Mark No Show
              </Button>
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
