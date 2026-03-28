import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, FileCheck, AlertCircle, Upload, ClipboardCheck, Eye, Car, Clock, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import VehicleInspectionDialog from './VehicleInspectionDialog';

const SecurityDashboard = () => {
  const { profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingVerifyId, setPendingVerifyId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);
  const [inspectionDrive, setInspectionDrive] = useState<any>(null);
  const [inspectionType, setInspectionType] = useState<'pre' | 'post'>('pre');
  const [inspectionViewDrive, setInspectionViewDrive] = useState<any>(null);

  useEffect(() => {
    fetchTodayDrives();
  }, [profile]);

  const fetchTodayDrives = async () => {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .eq('scheduled_date', today)
      .in('status', ['confirmed', 'show', 'in_progress', 'completed']);
    if (profile?.location_id) query = query.eq('location_id', profile.location_id);
    const { data } = await query.order('scheduled_time', { ascending: true });
    setTestDrives(data || []);
  };

  const checkIn = async (id: string) => {
    await supabase.from('test_drives').update({ security_checked_in_at: new Date().toISOString(), status: 'show' as any }).eq('id', id);
    toast({ title: 'Customer checked in' });
    fetchTodayDrives();
  };

  const checkOut = async (id: string) => {
    await supabase.from('test_drives').update({ security_checked_out_at: new Date().toISOString() }).eq('id', id);
    toast({ title: 'Customer checked out' });
    fetchTodayDrives();
  };

  const openLicensePreview = async (customerId: string, licenseUrl: string) => {
    setPendingVerifyId(customerId);
    setPreviewOpen(true);
    if (licenseUrl.startsWith('http')) {
      const bucketPath = licenseUrl.split('/storage/v1/object/public/documents/')[1] || licenseUrl.split('/storage/v1/object/sign/documents/')[1];
      if (bucketPath) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(bucketPath, 300);
        setPreviewUrl(data?.signedUrl || licenseUrl);
      } else { setPreviewUrl(licenseUrl); }
    } else {
      const { data } = await supabase.storage.from('documents').createSignedUrl(licenseUrl, 300);
      setPreviewUrl(data?.signedUrl || licenseUrl);
    }
  };

  const confirmVerify = async () => {
    if (!pendingVerifyId) return;
    await supabase.from('customers').update({ driving_license_verified: true }).eq('id', pendingVerifyId);
    toast({ title: 'License verified' });
    setPreviewOpen(false);
    setPendingVerifyId(null);
    fetchTodayDrives();
  };

  const openRejectDialog = (customerId: string) => {
    setPendingRejectId(customerId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!pendingRejectId) return;
    await supabase.from('customers').update({ driving_license_url: null, driving_license_verified: false }).eq('id', pendingRejectId);
    toast({ title: 'License rejected', description: rejectReason || 'Customer must re-upload their license' });
    setRejectOpen(false);
    setPendingRejectId(null);
    setPreviewOpen(false);
    fetchTodayDrives();
  };

  const handleReuploadLicense = async (customerId: string, file: File) => {
    setReuploadingId(customerId);
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
      await supabase.from('customers').update({ driving_license_url: path, driving_license_verified: false }).eq('id', customerId);
      toast({ title: 'License re-uploaded', description: 'Ready for verification' });
      fetchTodayDrives();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally { setReuploadingId(null); }
  };

  const openInspection = (td: any, type: 'pre' | 'post') => {
    setInspectionDrive(td);
    setInspectionType(type);
  };

  const pendingCount = testDrives.filter(t => t.customers?.driving_license_url && !t.customers?.driving_license_verified).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Security Dashboard</h1>
        <p className="text-sm text-muted-foreground">Check-ins, inspections & verification</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Today's Visitors", value: testDrives.length, icon: Shield, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Checked In', value: testDrives.filter(t => t.security_checked_in_at).length, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'License OK', value: testDrives.filter(t => t.customers?.driving_license_verified).length, icon: FileCheck, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Pending', value: pendingCount, icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', alert: pendingCount > 0 },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`shadow-card ${(stat as any).alert ? 'border-warning/30' : ''}`}>
              <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
                <div className={`relative h-9 w-9 sm:h-12 sm:w-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
                  {(stat as any).alert && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
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
          <CardTitle className="font-heading text-base sm:text-lg">Today's Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testDrives.map(td => (
              <div key={td.id} className="p-3 sm:p-4 rounded-lg border border-border space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground text-sm sm:text-base">{td.customers?.full_name}</p>
                      <Badge variant="secondary" className={`text-xs ${
                        td.status === 'completed' ? 'bg-success/10 text-success' :
                        td.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>{td.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Car className="h-3 w-3" />{td.vehicles?.brand} {td.vehicles?.model}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{td.scheduled_time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!td.security_checked_in_at ? (
                      <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => checkIn(td.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Check In
                      </Button>
                    ) : !td.security_checked_out_at ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-success/10 text-success text-xs">Checked In</Badge>
                        <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => checkOut(td.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Check Out
                        </Button>
                      </div>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground text-xs">Checked Out</Badge>
                    )}
                  </div>
                </div>

                {/* License section */}
                <div className="flex items-center gap-2 flex-wrap">
                  {td.customers?.driving_license_url ? (
                    td.customers?.driving_license_verified ? (
                      <Badge className="bg-success/10 text-success text-xs">License Verified</Badge>
                    ) : (
                      <>
                        <Badge className="bg-warning/10 text-warning text-xs">License Pending</Badge>
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => openLicensePreview(td.customer_id, td.customers.driving_license_url)}>
                          <FileCheck className="h-3 w-3 mr-1" /> Verify
                        </Button>
                        <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs" onClick={() => openRejectDialog(td.customer_id)}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      <Badge className="bg-destructive/10 text-destructive text-xs">No License</Badge>
                      <Label htmlFor={`reupload-sec-${td.customer_id}`} className="cursor-pointer">
                        <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-xs" asChild>
                          <span><Upload className="h-3 w-3 mr-1" /> Upload</span>
                        </Button>
                      </Label>
                      <input id={`reupload-sec-${td.customer_id}`} type="file" accept="image/*,.pdf" className="hidden" disabled={reuploadingId === td.customer_id}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleReuploadLicense(td.customer_id, file); }} />
                    </>
                  )}
                </div>

                {/* Inspection */}
                <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border">
                  {td.status === 'in_progress' && !(td as any).pre_drive_km && (
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => openInspection(td, 'pre')}>
                      <ClipboardCheck className="h-3 w-3 mr-1" /> Pre-Drive
                    </Button>
                  )}
                  {(td as any).pre_drive_km && <Badge className="bg-primary/10 text-primary text-xs">Pre: {(td as any).pre_drive_km} km</Badge>}
                  {(td.status === 'completed' || (td.status === 'in_progress' && (td as any).pre_drive_km)) && !(td as any).post_drive_km && (
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => openInspection(td, 'post')}>
                      <ClipboardCheck className="h-3 w-3 mr-1" /> Post-Drive
                    </Button>
                  )}
                  {(td as any).post_drive_km && <Badge className="bg-success/10 text-success text-xs">Post: {(td as any).post_drive_km} km</Badge>}
                  {((td as any).pre_drive_km || (td as any).post_drive_km) && (
                    <Button size="sm" className="bg-muted text-foreground hover:bg-muted/80 text-xs" onClick={() => setInspectionViewDrive(td)}>
                      <Eye className="h-3 w-3 mr-1" /> Details
                    </Button>
                  )}
                  {(td as any).inspection_submitted_at && <Badge className="bg-muted text-muted-foreground text-xs">Complete</Badge>}
                </div>
              </div>
            ))}
            {testDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No appointments for today</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* License Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Driving License Preview</DialogTitle>
            <DialogDescription>Review the uploaded license before verifying</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[200px] sm:min-h-[300px]">
            {previewUrl ? (
              <img src={previewUrl} alt="Driving License" className="max-w-full max-h-[300px] sm:max-h-[400px] rounded-lg object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-muted-foreground">Unable to load license image.</p>'; }} />
            ) : <p className="text-muted-foreground">Loading preview...</p>}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setPreviewOpen(false); openRejectDialog(pendingVerifyId!); }}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={confirmVerify}>
              <CheckCircle className="h-4 w-4 mr-1" /> Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Driving License</DialogTitle>
            <DialogDescription>The license will be removed and must be re-uploaded.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea placeholder="e.g. Image is blurry, expired license..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmReject}>
              <XCircle className="h-4 w-4 mr-1" /> Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Inspection Dialog */}
      <VehicleInspectionDialog
        open={!!inspectionDrive}
        onClose={() => setInspectionDrive(null)}
        testDrive={inspectionDrive}
        type={inspectionType}
        onComplete={fetchTodayDrives}
      />

      {/* Inspection View Dialog */}
      <Dialog open={!!inspectionViewDrive} onOpenChange={() => setInspectionViewDrive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Inspection Report</DialogTitle>
            <DialogDescription>{inspectionViewDrive?.vehicles?.brand} {inspectionViewDrive?.vehicles?.model} — {inspectionViewDrive?.vehicles?.registration_number}</DialogDescription>
          </DialogHeader>
          {inspectionViewDrive && (
            <div className="space-y-4">
              {(inspectionViewDrive as any).pre_drive_km && (
                <div className="rounded-lg border border-border p-3 sm:p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-primary" /> Pre-Drive</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).pre_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).pre_drive_fuel_level || 'N/A'}</span></div>
                  </div>
                </div>
              )}
              {(inspectionViewDrive as any).post_drive_km && (
                <div className="rounded-lg border border-border p-3 sm:p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-success" /> Post-Drive</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_fuel_level || 'N/A'}</span></div>
                  </div>
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

export default SecurityDashboard;
