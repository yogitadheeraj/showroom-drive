import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarCheck, Upload, FileCheck, ArrowRightLeft, RotateCcw, Key, Eye, ClipboardCheck, Car, Clock, Phone, UserCog, CalendarClock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SalesSwapDialog from './SalesSwapDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logStaffActivity } from '@/lib/activityLogger';

const SalesDashboard = () => {
  const { user, profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [swapDrive, setSwapDrive] = useState<any>(null);
  const [reassignDrive, setReassignDrive] = useState<any>(null);
  const [rescheduleDrive, setRescheduleDrive] = useState<any>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'security' | 'status'>('all');
  const [inspectionViewDrive, setInspectionViewDrive] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignedDrives();
  }, [user]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`sales-completion-notify-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'test_drives',
          filter: `assigned_sales_person_id=eq.${profile.id}`,
        },
        async (payload) => {
          const before = payload.old as any;
          const after = payload.new as any;

          if (after?.status !== 'completed' || before?.status === 'completed') return;

          const { data: drive } = await supabase
            .from('test_drives')
            .select('id, customers(full_name)')
            .eq('id', after.id)
            .maybeSingle();

          const customerName = drive?.customers?.full_name || 'Customer';

          toast({
            title: 'Test drive completed',
            description: `Please take follow up from Mr. ${customerName}`,
          });

          void fetchAssignedDrives();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, toast]);

  const fetchAssignedDrives = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .eq('assigned_sales_person_id', profile.id)
      .order('scheduled_date', { ascending: true });
    setTestDrives(data || []);
  };

  const handleUploadLicense = async (testDriveId: string, customerId: string, file: File) => {
    setUploading(testDriveId);
    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG, WEBP, or PDF files are allowed');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be 5MB or less');
      }

      const ext = file.name.split('.').pop();
      const path = `licenses/${customerId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;
      await supabase.from('customers').update({ driving_license_url: path }).eq('id', customerId);
      toast({ title: 'License uploaded successfully' });
      fetchAssignedDrives();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleGiveKeyAndStart = async (id: string) => {
    await supabase.from('test_drives').update({
      key_handed_at: new Date().toISOString(),
      status: 'in_progress' as any,
    } as any).eq('id', id);
    if (user?.id) {
      await logStaffActivity({
        userId: user.id,
        profileId: profile?.id,
        locationId: profile?.location_id,
        role: 'sales',
        eventType: 'test_drive_started',
        label: 'Handed over key and started test drive',
        metadata: { testDriveId: id },
      });
    }
    toast({ title: 'Key handed over', description: 'Test drive marked as in progress' });
    fetchAssignedDrives();
  };

  const handleComplete = async (id: string) => {
    await supabase.from('test_drives').update({
      status: 'completed' as any,
      completed_at: new Date().toISOString(),
    }).eq('id', id);
    if (user?.id) {
      await logStaffActivity({
        userId: user.id,
        profileId: profile?.id,
        locationId: profile?.location_id,
        role: 'sales',
        eventType: 'test_drive_completed',
        label: 'Marked test drive as completed',
        metadata: { testDriveId: id },
      });
    }
    toast({ title: 'Test drive completed' });
    fetchAssignedDrives();
  };

  const handleReschedule = async () => {
    if (!rescheduleDrive?.id || !newDate || !newTime) return;

    await supabase.from('test_drives')
      .update({
        scheduled_date: newDate,
        scheduled_time: `${newTime}:00`,
        status: 'rescheduled' as any,
        notes: `${rescheduleDrive.notes || ''}\n[${new Date().toLocaleString()}] Rescheduled by ${profile?.full_name || 'Sales'} to ${newDate} ${newTime}`.trim(),
      })
      .eq('id', rescheduleDrive.id);

    if (user?.id) {
      await logStaffActivity({
        userId: user.id,
        profileId: profile?.id,
        locationId: profile?.location_id,
        role: 'sales',
        eventType: 'test_drive_rescheduled',
        label: 'Rescheduled test drive',
        metadata: { testDriveId: rescheduleDrive.id, scheduledDate: newDate, scheduledTime: newTime },
      });
    }

    toast({ title: 'Test drive rescheduled' });
    setRescheduleDrive(null);
    setNewDate('');
    setNewTime('');
    fetchAssignedDrives();
  };

  const assignedLogs = testDrives
    .flatMap(td => {
      const logs: Array<{ type: 'security' | 'status'; at: string; message: string; driveId: string }> = [];

      if (td.security_checked_in_at) {
        logs.push({
          type: 'security',
          at: td.security_checked_in_at,
          message: `${td.customers?.full_name} checked in at security`,
          driveId: td.id,
        });
      }

      if (td.security_checked_out_at) {
        logs.push({
          type: 'security',
          at: td.security_checked_out_at,
          message: `${td.customers?.full_name} checked out at security`,
          driveId: td.id,
        });
      }

      if (td.status === 'no_show') {
        logs.push({
          type: 'status',
          at: td.updated_at || td.created_at,
          message: `${td.customers?.full_name} marked as no-show`,
          driveId: td.id,
        });
      }

      if (td.status === 'completed') {
        logs.push({
          type: 'status',
          at: td.completed_at || td.updated_at || td.created_at,
          message: `${td.customers?.full_name} test drive completed`,
          driveId: td.id,
        });
      }

      if (td.status === 'rescheduled') {
        logs.push({
          type: 'status',
          at: td.updated_at || td.created_at,
          message: `${td.customers?.full_name} test drive rescheduled`,
          driveId: td.id,
        });
      }

      return logs;
    })
    .filter(log => logFilter === 'all' || log.type === logFilter)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Sales Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your assigned test drives</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Assigned', value: testDrives.length, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'In Progress', value: testDrives.filter(t => t.status === 'in_progress').length, icon: Key, color: 'text-info', bg: 'bg-green/10' },
          { label: 'Completed', value: testDrives.filter(t => t.status === 'completed').length, icon: FileCheck, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Pending License', value: testDrives.filter(t => !t.customers?.driving_license_url).length, icon: Upload, color: 'text-warning', bg: 'bg-warning/10' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
                <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="font-heading text-base sm:text-lg">Assigned Test Drives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {testDrives.map(td => (
              <div key={td.id} className="p-3 sm:p-4 rounded-lg border border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground text-sm sm:text-base">{td.customers?.full_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />{td.customers?.phone}
                      {td.customers?.email && <><span>•</span>{td.customers.email}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${statusColor[td.status] || ''}`}>
                      {td.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Car className="h-3 w-3" />{td.vehicles?.brand} {td.vehicles?.model}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{td.scheduled_date} {td.scheduled_time}</span>
                </div>

                {/* License section */}
                {!td.customers?.driving_license_url ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <Label htmlFor={`license-${td.id}`} className="text-xs shrink-0">Upload License:</Label>
                    <Input id={`license-${td.id}`} type="file" accept="image/*,.pdf" className="max-w-full sm:max-w-xs text-xs" disabled={uploading === td.id}
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadLicense(td.id, td.customer_id, file); }} />
                    {uploading === td.id && <span className="text-xs text-muted-foreground">Uploading...</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileCheck className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs text-success">License uploaded</span>
                    {!td.customers?.driving_license_verified && (
                      <>
                        <Badge variant="outline" className="text-warning text-xs">Pending verification</Badge>
                        <Label htmlFor={`reupload-${td.id}`} className="cursor-pointer">
                          <Button size="sm" className="bg-muted text-muted-foreground hover:bg-muted/80 text-xs h-7" asChild>
                            <span><RotateCcw className="h-3 w-3 mr-1" /> Re-upload</span>
                          </Button>
                        </Label>
                        <input id={`reupload-${td.id}`} type="file" accept="image/*,.pdf" className="hidden" disabled={uploading === td.id}
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadLicense(td.id, td.customer_id, file); }} />
                      </>
                    )}
                    {td.customers?.driving_license_verified && <Badge variant="outline" className="text-success text-xs">Verified</Badge>}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                  {['scheduled', 'confirmed', 'show'].includes(td.status) && (
                    <>
                      <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-xs" onClick={() => setReassignDrive(td)}>
                        <UserCog className="h-3.5 w-3.5 mr-1" /> Reassign
                      </Button>
                      <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={() => setSwapDrive(td)}>
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Swap
                      </Button>
                      <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => { setRescheduleDrive(td); setNewDate(td.scheduled_date || ''); setNewTime((td.scheduled_time || '').substring(0, 5)); }}>
                        <CalendarClock className="h-3.5 w-3.5 mr-1" /> Reschedule
                      </Button>
                    </>
                  )}
                  {td.status === 'show' && (
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => handleGiveKeyAndStart(td.id)}>
                      <Key className="h-3.5 w-3.5 mr-1" /> Give Key & Start
                    </Button>
                  )}
                  {(td.status === 'in_progress' || (td.security_checked_out_at && td.status !== 'completed')) && (
                    <>
                      <Badge className="bg-primary/10 text-primary text-xs"><Key className="h-3 w-3 mr-1" /> Key Handed</Badge>
                      <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => handleComplete(td.id)}>
                        <FileCheck className="h-3.5 w-3.5 mr-1" /> Complete
                      </Button>
                    </>
                  )}
                  {td.status === 'completed' && ((td as any).pre_drive_km || (td as any).post_drive_km) && (
                    <Button size="sm" className="bg-muted text-foreground hover:bg-muted/80 text-xs" onClick={() => setInspectionViewDrive(td)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Inspection
                    </Button>
                  )}
                  {td.status === 'completed' && (td as any).inspection_submitted_at && (
                    <Badge className="bg-success/10 text-success text-xs"><ClipboardCheck className="h-3 w-3 mr-1" /> Done</Badge>
                  )}
                </div>
              </div>
            ))}
            {testDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No test drives assigned to you</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-2 sm:pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="font-heading text-base sm:text-lg">Assigned Activity Logs</CardTitle>
          <Select value={logFilter} onValueChange={(v: 'all' | 'security' | 'status') => setLogFilter(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Logs</SelectItem>
              <SelectItem value="security">Security Logs</SelectItem>
              <SelectItem value="status">No Show / Complete / Reschedule</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {assignedLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No logs found for your assigned test drives.</p>
          ) : (
            <div className="space-y-2">
              {assignedLogs.map((log, index) => (
                <div key={`${log.driveId}-${log.at}-${index}`} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground flex items-center gap-2">
                      {log.type === 'security' ? (
                        <ShieldCheck className="h-4 w-4 text-info shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                      )}
                      <span className="truncate">{log.message}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Drive: {log.driveId}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{new Date(log.at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SalesSwapDialog open={!!reassignDrive} onClose={() => setReassignDrive(null)} testDrive={reassignDrive} onSwapped={fetchAssignedDrives} mode="reassign" />

      <SalesSwapDialog open={!!swapDrive} onClose={() => setSwapDrive(null)} testDrive={swapDrive} onSwapped={fetchAssignedDrives} mode="swap" />

      <Dialog open={!!rescheduleDrive} onOpenChange={() => setRescheduleDrive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reschedule Assigned Test Drive</DialogTitle>
            <DialogDescription>
              {rescheduleDrive?.customers?.full_name} • {rescheduleDrive?.vehicles?.brand} {rescheduleDrive?.vehicles?.model}
            </DialogDescription>
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
            <Button onClick={handleReschedule} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!newDate || !newTime}>
              Confirm Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inspection Details Dialog */}
      <Dialog open={!!inspectionViewDrive} onOpenChange={() => setInspectionViewDrive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Inspection Report</DialogTitle>
            <DialogDescription>{inspectionViewDrive?.vehicles?.brand} {inspectionViewDrive?.vehicles?.model} — {inspectionViewDrive?.vehicles?.registration_number}</DialogDescription>
          </DialogHeader>
          {inspectionViewDrive && (
            <div className="space-y-4">
              {(inspectionViewDrive as any).pre_drive_km && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Pre-Drive</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).pre_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).pre_drive_fuel_level || 'N/A'}</span></div>
                  </div>
                  {(inspectionViewDrive as any).pre_drive_scratches && <div className="text-sm"><span className="text-muted-foreground">Scratches:</span> {(inspectionViewDrive as any).pre_drive_scratches}</div>}
                  {(inspectionViewDrive as any).pre_drive_notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {(inspectionViewDrive as any).pre_drive_notes}</div>}
                </div>
              )}
              {(inspectionViewDrive as any).post_drive_km && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" /> Post-Drive</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_fuel_level || 'N/A'}</span></div>
                  </div>
                  {(inspectionViewDrive as any).post_drive_scratches && <div className="text-sm"><span className="text-muted-foreground">Scratches:</span> {(inspectionViewDrive as any).post_drive_scratches}</div>}
                  {(inspectionViewDrive as any).post_drive_notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {(inspectionViewDrive as any).post_drive_notes}</div>}
                </div>
              )}
              {(inspectionViewDrive as any).pre_drive_km && (inspectionViewDrive as any).post_drive_km && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium text-foreground">Distance: {((inspectionViewDrive as any).post_drive_km - (inspectionViewDrive as any).pre_drive_km).toFixed(1)} km</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setInspectionViewDrive(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesDashboard;
