import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, FileCheck, AlertCircle, Upload, ClipboardCheck, Eye, Car, Clock, File, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import VehicleInspectionDialog from './VehicleInspectionDialog';
import { logStaffActivity } from '@/lib/activityLogger';

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
  const [testDriveDocuments, setTestDriveDocuments] = useState<Record<string, any[]>>({});
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [docViewOpen, setDocViewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    fetchDrives();
  }, [profile]);

  const fetchTestDriveDocuments = async (testDriveId: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .list(`test-drives/${testDriveId}`, { limit: 100 });

      if (error) throw error;

      setTestDriveDocuments((prev) => ({
        ...prev,
        [testDriveId]: data || [],
      }));
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchDrives = async () => {
    let query = supabase
      .from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .in('status', ['confirmed', 'show', 'in_progress', 'completed']);

    if (profile?.location_id) query = query.eq('location_id', profile.location_id);

    const { data } = await query
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    setTestDrives(data || []);

    if (data) {
      data.forEach((testDrive) => {
        void fetchTestDriveDocuments(testDrive.id);
      });
    }
  };

  const handleUploadTestDriveDoc = async (testDriveId: string, file: File) => {
    setUploadingDocId(testDriveId);
    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG, WEBP, or PDF files are allowed');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be 10MB or less');
      }

      const ext = file.name.split('.').pop();
      const path = `test-drives/${testDriveId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;

      if (profile?.user_id) {
        await logStaffActivity({
          userId: profile.user_id,
          profileId: profile.id,
          locationId: profile.location_id,
          role: 'security',
          eventType: 'license_uploaded',
          label: 'Uploaded test drive document',
          metadata: { testDriveId, path },
        });
      }

      toast({ title: 'Document uploaded successfully' });
      void fetchTestDriveDocuments(testDriveId);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleDeleteDocument = async (testDriveId: string, filename: string) => {
    try {
      const { error } = await supabase.storage
        .from('documents')
        .remove([`test-drives/${testDriveId}/${filename}`]);

      if (error) throw error;

      toast({ title: 'Document deleted' });
      void fetchTestDriveDocuments(testDriveId);
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const viewDocument = async (testDriveId: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(`test-drives/${testDriveId}/${filename}`, 300);

      if (error) throw error;

      setSelectedDoc({ url: data.signedUrl, filename });
      setDocViewOpen(true);
    } catch (err: any) {
      toast({ title: 'Failed to view document', description: err.message, variant: 'destructive' });
    }
  };

  const checkIn = async (id: string) => {
    await supabase
      .from('test_drives')
      .update({ security_checked_in_at: new Date().toISOString(), status: 'in_progress' as any })
      .eq('id', id);

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'security',
        eventType: 'test_drive_check_in',
        label: 'Checked in customer for test drive',
        metadata: { testDriveId: id },
      });
    }

    toast({ title: 'Customer checked in & test drive started' });
    void fetchDrives();
  };

  const checkOut = async (id: string) => {
    await supabase.from('test_drives').update({ security_checked_out_at: new Date().toISOString() }).eq('id', id);

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'security',
        eventType: 'test_drive_check_out',
        label: 'Checked out customer from test drive',
        metadata: { testDriveId: id },
      });
    }

    toast({ title: 'Customer checked out' });
    void fetchDrives();
  };

  const openLicensePreview = async (customerId: string, licenseUrl: string) => {
    setPendingVerifyId(customerId);
    setPreviewOpen(true);

    if (licenseUrl.startsWith('http')) {
      const bucketPath = licenseUrl.split('/storage/v1/object/public/documents/')[1]
        || licenseUrl.split('/storage/v1/object/sign/documents/')[1];

      if (bucketPath) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(bucketPath, 300);
        setPreviewUrl(data?.signedUrl || licenseUrl);
      } else {
        setPreviewUrl(licenseUrl);
      }
      return;
    }

    const { data } = await supabase.storage.from('documents').createSignedUrl(licenseUrl, 300);
    setPreviewUrl(data?.signedUrl || licenseUrl);
  };

  const confirmVerify = async () => {
    if (!pendingVerifyId) return;

    await supabase.from('customers').update({ driving_license_verified: true }).eq('id', pendingVerifyId);

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'security',
        eventType: 'license_verified',
        label: 'Verified customer driving license',
        metadata: { customerId: pendingVerifyId },
      });
    }

    toast({ title: 'License verified' });
    setPreviewOpen(false);
    setPendingVerifyId(null);
    void fetchDrives();
  };

  const openRejectDialog = (customerId: string) => {
    setPendingRejectId(customerId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!pendingRejectId) return;

    await supabase.from('customers').update({ driving_license_url: null, driving_license_verified: false }).eq('id', pendingRejectId);

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'security',
        eventType: 'license_rejected',
        label: 'Rejected customer driving license',
        metadata: { customerId: pendingRejectId, reason: rejectReason || null },
      });
    }

    toast({ title: 'License rejected', description: rejectReason || 'Customer must re-upload their license' });
    setRejectOpen(false);
    setPendingRejectId(null);
    setPreviewOpen(false);
    void fetchDrives();
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

      if (profile?.user_id) {
        await logStaffActivity({
          userId: profile.user_id,
          profileId: profile.id,
          locationId: profile.location_id,
          role: 'security',
          eventType: 'license_uploaded',
          label: 'Uploaded driving license on behalf of customer',
          metadata: { customerId, path },
        });
      }

      await supabase
        .from('customers')
        .update({ driving_license_url: path, driving_license_verified: false })
        .eq('id', customerId);

      toast({ title: 'License re-uploaded', description: 'Ready for verification' });
      void fetchDrives();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setReuploadingId(null);
    }
  };

  const openInspection = (testDrive: any, type: 'pre' | 'post') => {
    setInspectionDrive(testDrive);
    setInspectionType(type);
  };

  const pendingCount = testDrives.filter((testDrive) => testDrive.customers?.driving_license_url && !testDrive.customers?.driving_license_verified).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Security Dashboard</h1>
        <p className="text-sm text-muted-foreground">Check-ins, inspections & verification for your location</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Test Drives', value: testDrives.length, icon: Shield, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Checked In', value: testDrives.filter((testDrive) => testDrive.security_checked_in_at).length, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'License OK', value: testDrives.filter((testDrive) => testDrive.customers?.driving_license_verified).length, icon: FileCheck, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Pending', value: pendingCount, icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', alert: pendingCount > 0 },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`shadow-card ${stat.alert ? 'border-warning/30' : ''}`}>
              <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
                <div className={`relative h-9 w-9 sm:h-12 sm:w-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
                  {stat.alert && (
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
          <CardTitle className="font-heading text-base sm:text-lg">All Test Drives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testDrives.map((testDrive) => (
              <div key={testDrive.id} className="p-3 sm:p-4 rounded-lg border border-border space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground text-sm sm:text-base">{testDrive.customers?.full_name}</p>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          testDrive.status === 'completed'
                            ? 'bg-success/10 text-success'
                            : testDrive.status === 'in_progress'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {testDrive.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Car className="h-3 w-3" />{testDrive.vehicles?.brand} {testDrive.vehicles?.model}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{testDrive.scheduled_date} at {testDrive.scheduled_time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!testDrive.security_checked_in_at ? (
                      <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => void checkIn(testDrive.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Check In
                      </Button>
                    ) : !testDrive.security_checked_out_at ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-success/10 text-success text-xs">Checked In</Badge>
                        <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => void checkOut(testDrive.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Check Out
                        </Button>
                      </div>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground text-xs">Checked Out</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {testDrive.customers?.driving_license_url ? (
                    testDrive.customers?.driving_license_verified ? (
                      <Badge className="bg-success/10 text-success text-xs">License Verified</Badge>
                    ) : (
                      <>
                        <Badge className="bg-warning/10 text-warning text-xs">License Pending</Badge>
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => void openLicensePreview(testDrive.customer_id, testDrive.customers.driving_license_url)}>
                          <FileCheck className="h-3 w-3 mr-1" /> Verify
                        </Button>
                        <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs" onClick={() => openRejectDialog(testDrive.customer_id)}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      <Badge className="bg-destructive/10 text-destructive text-xs">No License</Badge>
                      <Label htmlFor={`reupload-sec-${testDrive.customer_id}`} className="cursor-pointer">
                        <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-xs" asChild>
                          <span><Upload className="h-3 w-3 mr-1" /> Upload</span>
                        </Button>
                      </Label>
                      <input
                        id={`reupload-sec-${testDrive.customer_id}`}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        disabled={reuploadingId === testDrive.customer_id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleReuploadLicense(testDrive.customer_id, file);
                        }}
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border">
                  {testDrive.status === 'in_progress' && !(testDrive as any).pre_drive_km && (
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => openInspection(testDrive, 'pre')}>
                      <ClipboardCheck className="h-3 w-3 mr-1" /> Pre-Drive
                    </Button>
                  )}
                  {(testDrive as any).pre_drive_km && <Badge className="bg-primary/10 text-primary text-xs">Pre: {(testDrive as any).pre_drive_km} km</Badge>}
                  {(testDrive.status === 'completed' || (testDrive.status === 'in_progress' && (testDrive as any).pre_drive_km)) && !(testDrive as any).post_drive_km && (
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => openInspection(testDrive, 'post')}>
                      <ClipboardCheck className="h-3 w-3 mr-1" /> Post-Drive
                    </Button>
                  )}
                  {(testDrive as any).post_drive_km && <Badge className="bg-success/10 text-success text-xs">Post: {(testDrive as any).post_drive_km} km</Badge>}
                  {((testDrive as any).pre_drive_km || (testDrive as any).post_drive_km) && (
                    <Button size="sm" className="bg-muted text-foreground hover:bg-muted/80 text-xs" onClick={() => setInspectionViewDrive(testDrive)}>
                      <Eye className="h-3 w-3 mr-1" /> Details
                    </Button>
                  )}
                  {(testDrive as any).inspection_submitted_at && <Badge className="bg-muted text-muted-foreground text-xs">Complete</Badge>}
                </div>

                <div className="pt-1.5 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Vehicle Documents</p>
                    <Label htmlFor={`doc-upload-${testDrive.id}`} className="cursor-pointer">
                      <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs" asChild>
                        <span><Upload className="h-3 w-3 mr-1" /> Add</span>
                      </Button>
                    </Label>
                    <input
                      id={`doc-upload-${testDrive.id}`}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={uploadingDocId === testDrive.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUploadTestDriveDoc(testDrive.id, file);
                      }}
                    />
                  </div>
                  {testDriveDocuments[testDrive.id]?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {testDriveDocuments[testDrive.id].map((doc: any, index: number) => (
                        <div key={index} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted">
                          <File className="h-3 w-3" />
                          <button className="text-primary hover:underline" onClick={() => void viewDocument(testDrive.id, doc.name)}>
                            {doc.name.split('/').pop()?.substring(0, 20)}...
                          </button>
                          <button className="text-destructive hover:text-destructive/80 ml-1" onClick={() => void handleDeleteDocument(testDrive.id, doc.name)}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No documents yet</p>
                  )}
                </div>
              </div>
            ))}
            {testDrives.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No test drives for your location</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Driving License Preview</DialogTitle>
            <DialogDescription>Review the uploaded license before verifying</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[200px] sm:min-h-[300px]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Driving License"
                className="max-w-full max-h-[300px] sm:max-h-[400px] rounded-lg object-contain"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                  (event.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-muted-foreground">Unable to load license image.</p>';
                }}
              />
            ) : <p className="text-muted-foreground">Loading preview...</p>}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setPreviewOpen(false); openRejectDialog(pendingVerifyId!); }}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void confirmVerify()}>
              <CheckCircle className="h-4 w-4 mr-1" /> Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Driving License</DialogTitle>
            <DialogDescription>The license will be removed and must be re-uploaded.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea placeholder="e.g. Image is blurry, expired license..." value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void confirmReject()}>
              <XCircle className="h-4 w-4 mr-1" /> Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VehicleInspectionDialog
        open={!!inspectionDrive}
        onClose={() => setInspectionDrive(null)}
        testDrive={inspectionDrive}
        type={inspectionType}
        onComplete={fetchDrives}
      />

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

      <Dialog open={docViewOpen} onOpenChange={setDocViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>{selectedDoc?.filename}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[200px] sm:min-h-[400px]">
            {selectedDoc?.url ? (
              selectedDoc.filename.toLowerCase().endsWith('.pdf') ? (
                <iframe src={selectedDoc.url} className="w-full h-[400px] rounded-lg" title="PDF Preview" />
              ) : (
                <img
                  src={selectedDoc.url}
                  alt={selectedDoc.filename}
                  className="max-w-full max-h-[400px] rounded-lg object-contain"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = 'none';
                    (event.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-muted-foreground">Unable to load document.</p>';
                  }}
                />
              )
            ) : <p className="text-muted-foreground">Loading...</p>}
          </div>
          <DialogFooter>
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setDocViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityDashboard;
