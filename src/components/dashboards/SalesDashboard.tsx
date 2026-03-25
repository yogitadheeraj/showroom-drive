import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarCheck, Upload, FileCheck, ArrowRightLeft, RotateCcw, Key, Eye, ClipboardCheck } from 'lucide-react';
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
    await supabase.from('test_drives').update({
      status: 'completed' as any,
    }).eq('id', id);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Sales Dashboard</h1>
        <p className="text-muted-foreground">Your assigned test drives</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <CalendarCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned</p>
              <p className="text-2xl font-heading font-bold text-foreground">{testDrives.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Key className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => t.status === 'in_progress').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Upload className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending License</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => !t.customers?.driving_license_url).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Assigned Test Drives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testDrives.map(td => (
              <div key={td.id} className="p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{td.customers?.phone} • {td.customers?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={statusColor[td.status] || ''}>
                      {td.status.replace('_', ' ')}
                    </Badge>
                    {['scheduled', 'confirmed', 'show'].includes(td.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setSwapDrive(td)} title="Swap with teammate">
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span>{td.vehicles?.brand} {td.vehicles?.model}</span>
                  <span>{td.vehicles?.registration_number}</span>
                  <span>{td.scheduled_date}</span>
                  <span>{td.scheduled_time}</span>
                </div>
                {td.notes && (
                  <div className="mb-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground whitespace-pre-line">
                    {td.notes}
                  </div>
                )}

                {/* License section */}
                {!td.customers?.driving_license_url ? (
                  <div className="flex items-center gap-3 mb-3">
                    <Label htmlFor={`license-${td.id}`} className="text-sm">Upload Driving License:</Label>
                    <Input
                      id={`license-${td.id}`}
                      type="file"
                      accept="image/*,.pdf"
                      className="max-w-xs"
                      disabled={uploading === td.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadLicense(td.id, td.customer_id, file);
                      }}
                    />
                    {uploading === td.id && <span className="text-xs text-muted-foreground">Uploading...</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <FileCheck className="h-4 w-4 text-success" />
                    <span className="text-sm text-success">License uploaded</span>
                    {!td.customers?.driving_license_verified && (
                      <>
                        <Badge variant="outline" className="text-warning">Pending verification</Badge>
                        <Label htmlFor={`reupload-${td.id}`} className="cursor-pointer">
                          <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
                            <span><RotateCcw className="h-3 w-3 mr-1" /> Re-upload</span>
                          </Button>
                        </Label>
                        <input
                          id={`reupload-${td.id}`}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          disabled={uploading === td.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadLicense(td.id, td.customer_id, file);
                          }}
                        />
                      </>
                    )}
                    {td.customers?.driving_license_verified && (
                      <Badge variant="outline" className="text-success">Verified</Badge>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                  {td.status === 'show' && (
                    <Button size="sm" onClick={() => handleGiveKeyAndStart(td.id)}>
                      <Key className="h-4 w-4 mr-1" /> Give Key & Start Drive
                    </Button>
                  )}
                  {td.status === 'in_progress' && (
                    <>
                      <Badge className="bg-primary/10 text-primary">
                        <Key className="h-3 w-3 mr-1" /> Key Handed
                      </Badge>
                      <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleComplete(td.id)}>
                        <FileCheck className="h-4 w-4 mr-1" /> Mark Completed
                      </Button>
                    </>
                  )}
                  {/* Inspection details for completed drives */}
                  {td.status === 'completed' && ((td as any).pre_drive_km || (td as any).post_drive_km) && (
                    <Button size="sm" variant="outline" onClick={() => setInspectionViewDrive(td)}>
                      <Eye className="h-4 w-4 mr-1" /> View Inspection
                    </Button>
                  )}
                  {td.status === 'completed' && (td as any).inspection_submitted_at && (
                    <Badge className="bg-success/10 text-success">
                      <ClipboardCheck className="h-3 w-3 mr-1" /> Inspection Complete
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {testDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No test drives assigned to you</p>
            )}
          </div>
        </CardContent>
      </Card>

      <SalesSwapDialog
        open={!!swapDrive}
        onClose={() => setSwapDrive(null)}
        testDrive={swapDrive}
        onSwapped={fetchAssignedDrives}
      />

      {/* Inspection Details Dialog */}
      <Dialog open={!!inspectionViewDrive} onOpenChange={() => setInspectionViewDrive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Inspection Report
            </DialogTitle>
            <DialogDescription>
              {inspectionViewDrive?.vehicles?.brand} {inspectionViewDrive?.vehicles?.model} — {inspectionViewDrive?.vehicles?.registration_number}
            </DialogDescription>
          </DialogHeader>
          {inspectionViewDrive && (
            <div className="space-y-4">
              {(inspectionViewDrive as any).pre_drive_km && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Pre-Drive
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).pre_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).pre_drive_fuel_level || 'N/A'}</span></div>
                  </div>
                  {(inspectionViewDrive as any).pre_drive_scratches && (
                    <div className="text-sm"><span className="text-muted-foreground">Scratches:</span> {(inspectionViewDrive as any).pre_drive_scratches}</div>
                  )}
                  {(inspectionViewDrive as any).pre_drive_notes && (
                    <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {(inspectionViewDrive as any).pre_drive_notes}</div>
                  )}
                </div>
              )}
              {(inspectionViewDrive as any).post_drive_km && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" /> Post-Drive
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_fuel_level || 'N/A'}</span></div>
                  </div>
                  {(inspectionViewDrive as any).post_drive_scratches && (
                    <div className="text-sm"><span className="text-muted-foreground">Scratches:</span> {(inspectionViewDrive as any).post_drive_scratches}</div>
                  )}
                  {(inspectionViewDrive as any).post_drive_notes && (
                    <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {(inspectionViewDrive as any).post_drive_notes}</div>
                  )}
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
            <Button variant="outline" onClick={() => setInspectionViewDrive(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesDashboard;
