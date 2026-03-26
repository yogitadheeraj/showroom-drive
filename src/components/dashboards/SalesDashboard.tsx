import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarCheck, Upload, FileCheck, ArrowRightLeft, RotateCcw, Key, Eye, ClipboardCheck, Car, Clock, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SalesSwapDialog from './SalesSwapDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';

const SalesDashboard = () => {
  const { user, profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [swapDrive, setSwapDrive] = useState<any>(null);
  const [inspectionViewDrive, setInspectionViewDrive] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignedDrives();
  }, [user]);

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
    toast({ title: 'Key handed over', description: 'Test drive marked as in progress' });
    fetchAssignedDrives();
  };

  const handleComplete = async (id: string) => {
    await supabase.from('test_drives').update({ status: 'completed' as any }).eq('id', id);
    toast({ title: 'Test drive completed' });
    fetchAssignedDrives();
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Sales Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your assigned test drives</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Assigned', value: testDrives.length, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'In Progress', value: testDrives.filter(t => t.status === 'in_progress').length, icon: Key, color: 'text-info', bg: 'bg-info/10' },
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
                    {['scheduled', 'confirmed', 'show'].includes(td.status) && (
                      <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 h-7 w-7 p-0" onClick={() => setSwapDrive(td)} title="Swap">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
                  {td.status === 'show' && (
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => handleGiveKeyAndStart(td.id)}>
                      <Key className="h-3.5 w-3.5 mr-1" /> Give Key & Start
                    </Button>
                  )}
                  {td.status === 'in_progress' && (
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

      <SalesSwapDialog open={!!swapDrive} onClose={() => setSwapDrive(null)} testDrive={swapDrive} onSwapped={fetchAssignedDrives} />

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
