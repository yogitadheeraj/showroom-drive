import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '@/lib/apiClient';
import { getStorageSignedUrl, listStorageFiles, removeStorageFiles, uploadToStorage } from '@/lib/storageClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityInsightsMini } from '@/components/ActivityInsightsMini';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, FileCheck, AlertCircle, Upload, ClipboardCheck, Eye, Car, Clock, File, Trash2, Phone, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import VehicleInspectionDialog from './VehicleInspectionDialog';
import { logStaffActivity } from '@/lib/activityLogger';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';

const SecurityDashboard = () => {
  const { profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingVerifyId, setPendingVerifyId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);
  const [inspectionDrive, setInspectionDrive] = useState<any>(null);
  const [inspectionType, setInspectionType] = useState<'pre' | 'post'>('pre');
  const [pendingStartDriveId, setPendingStartDriveId] = useState<string | null>(null);
  const [pendingCompleteDriveId, setPendingCompleteDriveId] = useState<string | null>(null);
  const [inspectionViewDrive, setInspectionViewDrive] = useState<any>(null);
  const [testDriveDocuments, setTestDriveDocuments] = useState<Record<string, any[]>>({});
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [docViewOpen, setDocViewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [securityLogsByDrive, setSecurityLogsByDrive] = useState<Record<string, any[]>>({});
  const [detailSheetDrive, setDetailSheetDrive] = useState<any>(null);

  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  useEffect(() => {
    fetchDrives();
  }, [profile]);

  useTestDriveRealtime(profile?.location_id, () => {
    void fetchDrives();
  });

  const fetchTestDriveDocuments = async (testDriveId: string) => {
    try {
      const data = await listStorageFiles('documents', `test-drives/${testDriveId}`, 100);

      setTestDriveDocuments((prev) => ({
        ...prev,
        [testDriveId]: data || [],
      }));
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchDrives = async () => {
    const params = new URLSearchParams();
    if (profile?.location_id) params.set('location_id', profile.location_id);
    const enrichedDrives = await apiGet<any[]>(`/api/test-drives?${params.toString()}`) || [];
    setTestDrives(enrichedDrives);

    if (!enrichedDrives.length) {
      setSecurityLogsByDrive({});
      return;
    }

    const driveIds = new Set(enrichedDrives.map((d) => d.id));
    const eventTypes = 'test_drive_check_in,test_drive_check_out,test_drive_completed,vehicle_inspection_pre,vehicle_inspection_post,license_verified,license_rejected,test_drive_started, license_uploaded';
    const activityEvents = await apiGet<any[]>(`/api/activity/events?event_types=${encodeURIComponent(eventTypes)}&limit=1200`) || [];

    const actorProfileIds = Array.from(new Set(activityEvents.map((e: any) => e.profile_id).filter(Boolean)));
    const actorProfiles = actorProfileIds.length
      ? await apiGet<any[]>(`/api/profiles?ids=${encodeURIComponent(actorProfileIds.join(','))}`) || []
      : [];
    const actorMap = new Map((actorProfiles as any[]).map((p: any) => [p.id, p]));

    const logsByDrive: Record<string, any[]> = {};
    for (const event of activityEvents) {
      const testDriveId = (event as any)?.metadata?.testDriveId;
      if (!testDriveId || !driveIds.has(testDriveId)) continue;
      if (!logsByDrive[testDriveId]) logsByDrive[testDriveId] = [];

      const actor = actorMap.get((event as any)?.profile_id);
      const byName = (actor as any)?.full_name || ((event as any)?.role === 'sales' ? 'Sales' : 'Security');
      const byPhone = (actor as any)?.phone || null;

      logsByDrive[testDriveId].push({
        eventType: (event as any).event_type,
        label: (event as any).event_label || (event as any).event_type,
        happenedAt: (event as any).happened_at,
        by: byName,
        phone: byPhone,
      });
    }

    setSecurityLogsByDrive(logsByDrive);

    enrichedDrives.forEach((testDrive) => {
      void fetchTestDriveDocuments(testDrive.id);
    });
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
      await uploadToStorage('documents', path, file);

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
      await removeStorageFiles('documents', [`test-drives/${testDriveId}/${filename}`]);

      toast({ title: 'Document deleted' });
      void fetchTestDriveDocuments(testDriveId);
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const viewDocument = async (testDriveId: string, filename: string) => {
    try {
      const signedUrl = await getStorageSignedUrl('documents', `test-drives/${testDriveId}/${filename}`, 300);

      setSelectedDoc({ url: signedUrl, filename });
      setDocViewOpen(true);
    } catch (err: any) {
      toast({ title: 'Failed to view document', description: err.message, variant: 'destructive' });
    }
  };

  const checkIn = async (id: string) => {
    let drive = testDrives.find((item) => item.id === id);
    if (!drive || !drive.key_handed_at || !drive.customers?.driving_license_verified || !drive.pre_drive_km || !drive.pre_drive_fuel_level) {
      const freshDrive = await apiGet<any>(`/api/test-drives/${encodeURIComponent(id)}`);
      if (freshDrive) {
        drive = freshDrive;
      }
    }

    if (!drive?.key_handed_at) {
      toast({
        title: 'Vehicle not assigned yet',
        description: 'Sales must assign vehicle and hand over key before starting in progress.',
        variant: 'destructive',
      });
      return;
    }

    if (!drive?.customers?.driving_license_verified) {
      toast({
        title: 'License not verified',
        description: 'Verify driving license before starting in progress.',
        variant: 'destructive',
      });
      return;
    }

    if (!drive?.pre_drive_km || !drive?.pre_drive_fuel_level) {
      toast({
        title: 'Pre-drive inspection pending',
        description: 'Fill mileage and fuel level before starting in progress.',
        variant: 'destructive',
      });
      return;
    }

    await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { security_checked_in_at: new Date().toISOString(), status: 'in_progress' });

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

    toast({ title: 'Drive started by security', description: 'Status moved to in progress' });
    void fetchDrives();
  };

  const checkOut = async (id: string) => {
    let drive = testDrives.find((item) => item.id === id);
    if (!drive || !drive.key_handed_at || !drive.post_drive_km || !drive.post_drive_fuel_level) {
      const freshDrive = await apiGet<any>(`/api/test-drives/${encodeURIComponent(id)}`);
      if (freshDrive) {
        drive = freshDrive;
      }
    }
    if (!drive?.key_handed_at) {
      toast({
        title: 'Vehicle not assigned yet',
        description: 'Security can complete only after key is assigned by sales.',
        variant: 'destructive',
      });
      return;
    }

    if (!drive?.post_drive_km || !drive?.post_drive_fuel_level) {
      setPendingCompleteDriveId(id);
      openInspection(drive, 'post');
      toast({
        title: 'Post-drive inspection required',
        description: 'Fill post-drive mileage and fuel level to complete return.',
      });
      return;
    }

    const completedAt = new Date().toISOString();

    await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, {
      security_checked_out_at: completedAt,
      status: 'key_handover_to_sales',
    });

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'security',
        eventType: 'test_drive_check_out',
        label: 'Completed return and handed over key to sales',
        metadata: { testDriveId: id },
      });
    }

    toast({ title: 'Vehicle returned', description: 'Handed over to sales for customer follow-up and closure.' });
    void fetchDrives();
  };

  const openLicensePreview = async (customerId: string, licenseUrl: string) => {
    setPendingVerifyId(customerId);
    setPreviewOpen(true);

    if (licenseUrl.startsWith('http')) {
      const bucketPath = licenseUrl.split('/storage/v1/object/public/documents/')[1]
        || licenseUrl.split('/storage/v1/object/sign/documents/')[1];

      if (bucketPath) {
        const signedUrl = await getStorageSignedUrl('documents', bucketPath, 300);
        setPreviewUrl(signedUrl || licenseUrl);
      } else {
        setPreviewUrl(licenseUrl);
      }
      return;
    }

    const signedUrl = await getStorageSignedUrl('documents', licenseUrl, 300);
    setPreviewUrl(signedUrl || licenseUrl);
  };

  const confirmVerify = async () => {
    if (!pendingVerifyId) return;

    await apiPatch(`/api/customers/${encodeURIComponent(pendingVerifyId)}`, { driving_license_verified: true });

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

    await apiPatch(`/api/customers/${encodeURIComponent(pendingRejectId)}`, { driving_license_url: null, driving_license_verified: false });

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
      await uploadToStorage('documents', path, file);

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

      await apiPatch(`/api/customers/${encodeURIComponent(customerId)}`, { driving_license_url: path, driving_license_verified: false });

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
    if (type === 'post') {
      setPendingCompleteDriveId(testDrive.id);
    }
  };

  const getInspectionMedia = (testDriveId: string, type: 'pre' | 'post') => {
    return (testDriveDocuments[testDriveId] || []).filter((doc: any) => doc.name.startsWith(`inspection-${type}-`));
  };

  const handleInspectionClose = () => {
    setInspectionDrive(null);
    setPendingStartDriveId(null);
    setPendingCompleteDriveId(null);
  };

  const handleInspectionComplete = async () => {
    await fetchDrives();

    if (pendingStartDriveId) {
      const driveId = pendingStartDriveId;
      setPendingStartDriveId(null);
      await checkIn(driveId);
      return;
    }

    if (!pendingCompleteDriveId) return;

    const driveId = pendingCompleteDriveId;
    setPendingCompleteDriveId(null);
    await checkOut(driveId);
  };

  const pendingCount = testDrives.filter((testDrive) => testDrive.customers?.driving_license_url && !testDrive.customers?.driving_license_verified).length;
  const filteredDrives = testDrives.filter((drive) => {
    if (viewFilter === 'completed') return drive.status === 'completed';
    if (viewFilter === 'active') return drive.status !== 'completed' && drive.status !== 'cancelled';
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Security Dashboard</h1>
        <p className="text-sm text-muted-foreground">Check-ins, inspections & verification for your location</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Test Drives', value: testDrives.length, icon: Shield, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Checked In', value: testDrives.filter((testDrive) => testDrive.security_checked_in_at).length, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'License OK', value: testDrives.filter((testDrive) => testDrive.customers?.driving_license_verified).length, icon: FileCheck, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Pending Verification', value: pendingCount, icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', alert: pendingCount > 0 },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`shadow-card h-full min-w-0 ${stat.alert ? 'border-warning/30' : ''}`}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-h-[88px] sm:min-h-[96px]">
                <div className={`relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  {stat.alert && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
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

      {/* ── Activity Insights ── */}
      <ActivityInsightsMini />

      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm sm:text-base">Security SOP</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs sm:text-sm">
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">1.</span> Verify License Before Vehicle Movement.</div>
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">2.</span> Complete Pre-Drive Inspection, Then Start In Progress.</div>
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">3.</span> Upon Return, Submit Post-Drive Inspection.</div>
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">4.</span> Return And Handover To Close The Drive.</div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-heading text-base sm:text-lg">All Test Drives</CardTitle>
            <Select value={viewFilter} onValueChange={(v: 'all' | 'active' | 'completed') => setViewFilter(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="active">Active Records</SelectItem>
                <SelectItem value="completed">Completed Records</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5 sm:gap-3">
            {filteredDrives.slice(0, 5).map((testDrive) => (
              <div
                key={testDrive.id}
                className="p-3 rounded-lg border border-border bg-card/50 space-y-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setDetailSheetDrive(testDrive)}
              >
                {/* ── Top row: customer + status ── */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{testDrive.customers?.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" />Sales: {testDrive.profiles?.full_name || 'Unassigned'}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] shrink-0 ${
                      testDrive.status === 'completed' ? 'bg-success/10 text-success'
                      : testDrive.status === 'key_handover_to_sales' ? 'bg-warning/10 text-warning'
                      : testDrive.status === 'in_progress' ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {formatStatusLabel(testDrive.status)}
                  </Badge>
                </div>

                {/* ── Vehicle + Date ── */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Car className="h-3 w-3" />{testDrive.vehicles?.brand} {testDrive.vehicles?.model}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{testDrive.scheduled_date} {(testDrive.scheduled_time || '').substring(0, 5)}</span>
                </div>

                {/* ── Action row (stop propagation) ── */}
                <div className="flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  {!testDrive.security_checked_in_at ? (
                    !testDrive.key_handed_at ? (
                      <Badge className="bg-warning/10 text-warning text-xs">Awaiting Key Assignment</Badge>
                    ) : !testDrive.customers?.driving_license_verified ? (
                      <Badge className="bg-warning/10 text-warning text-xs">Verify License First</Badge>
                    ) : !(testDrive as any).pre_drive_km || !(testDrive as any).pre_drive_fuel_level ? (
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => { setPendingStartDriveId(testDrive.id); openInspection(testDrive, 'pre'); }}>
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Fill Pre-Drive & Start
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => void checkIn(testDrive.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Start In Progress
                      </Button>
                    )
                  ) : !testDrive.security_checked_out_at ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-success/10 text-success text-xs">In Progress</Badge>
                      {testDrive.key_handed_at ? (
                        <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs" onClick={() => void checkOut(testDrive.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Return & Handover
                        </Button>
                      ) : (
                        <Badge className="bg-warning/10 text-warning text-xs">Awaiting Vehicle Assignment</Badge>
                      )}
                    </div>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground text-xs">Checked Out By Security</Badge>
                  )}
                </div>

                {/* ── Licence section ── */}
                <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  {testDrive.customers?.driving_license_url ? (
                    testDrive.customers?.driving_license_verified ? (
                      <Badge className="bg-success/10 text-success text-xs">License Verified</Badge>
                    ) : (
                      <>
                        <Badge className="bg-warning/10 text-warning text-xs">License Verification Pending</Badge>
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
                      <input id={`reupload-sec-${testDrive.customer_id}`} type="file" accept="image/*,.pdf" className="hidden" disabled={reuploadingId === testDrive.customer_id}
                        onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleReuploadLicense(testDrive.customer_id, file); }} />
                    </>
                  )}
                </div>

                {/* ── KM badges + Inspection ── */}
                <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border" onClick={e => e.stopPropagation()}>
                  {(testDrive as any).pre_drive_km && <Badge className="bg-primary/10 text-primary text-xs">Pre: {(testDrive as any).pre_drive_km} km</Badge>}
                  {(testDrive as any).post_drive_km && <Badge className="bg-success/10 text-success text-xs">Post: {(testDrive as any).post_drive_km} km</Badge>}
                  {((testDrive as any).pre_drive_km || (testDrive as any).post_drive_km) && (
                    <Button size="sm" className="bg-muted text-foreground hover:bg-muted/80 text-xs" onClick={() => setInspectionViewDrive(testDrive)}>
                      <Eye className="h-3 w-3 mr-1" /> Details
                    </Button>
                  )}
                  {(testDrive as any).inspection_submitted_at && <Badge className="bg-muted text-muted-foreground text-xs">Complete</Badge>}
                  {/* Doc upload */}
                  <Label htmlFor={`doc-upload-${testDrive.id}`} className="cursor-pointer ml-auto">
                    <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs" asChild>
                      <span><Upload className="h-3 w-3 mr-1" /> Add Doc</span>
                    </Button>
                  </Label>
                  <input id={`doc-upload-${testDrive.id}`} type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingDocId === testDrive.id}
                    onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadTestDriveDoc(testDrive.id, file); }} />
                </div>
                {/* ── Uploaded docs ── */}
                {testDriveDocuments[testDrive.id]?.length > 0 && (
                  <div className="pt-1.5 border-t border-border" onClick={e => e.stopPropagation()}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Vehicle Documents</p>
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
                  </div>
                )}
              </div>
            ))}
            </div>
            {filteredDrives.length > 5 && (
              <div className="flex justify-center pt-3">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/test-drives')}>
                  View All {filteredDrives.length} Test Drives →
                </Button>
              </div>
            )}
            {filteredDrives.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No test drives found for selected filter</p>}
          </div>
        </CardContent>
      </Card>

      {/* Test Drive Detail Sheet */}
      <TestDriveDetailSheet
        testDrive={detailSheetDrive}
        open={!!detailSheetDrive}
        onClose={() => setDetailSheetDrive(null)}
        securityEvents={detailSheetDrive ? { logs: securityLogsByDrive[detailSheetDrive.id] } : undefined}
      />

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
        onClose={handleInspectionClose}
        testDrive={inspectionDrive}
        type={inspectionType}
        onComplete={() => void handleInspectionComplete()}
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
                  {getInspectionMedia(inspectionViewDrive.id, 'pre').length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground">Media</p>
                      <div className="flex flex-wrap gap-1">
                        {getInspectionMedia(inspectionViewDrive.id, 'pre').map((doc: any, idx: number) => (
                          <Button key={`${doc.name}-${idx}`} size="sm" variant="outline" className="h-7 text-xs" onClick={() => void viewDocument(inspectionViewDrive.id, doc.name)}>
                            <Eye className="h-3 w-3 mr-1" /> {doc.name.split('/').pop()?.slice(0, 18)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(inspectionViewDrive as any).post_drive_km && (
                <div className="rounded-lg border border-border p-3 sm:p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-success" /> Post-Drive</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div><span className="text-muted-foreground">Odometer:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_km} km</span></div>
                    <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{(inspectionViewDrive as any).post_drive_fuel_level || 'N/A'}</span></div>
                  </div>
                  {getInspectionMedia(inspectionViewDrive.id, 'post').length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground">Media</p>
                      <div className="flex flex-wrap gap-1">
                        {getInspectionMedia(inspectionViewDrive.id, 'post').map((doc: any, idx: number) => (
                          <Button key={`${doc.name}-${idx}`} size="sm" variant="outline" className="h-7 text-xs" onClick={() => void viewDocument(inspectionViewDrive.id, doc.name)}>
                            <Eye className="h-3 w-3 mr-1" /> {doc.name.split('/').pop()?.slice(0, 18)}
                          </Button>
                        ))}
                      </div>
                    </div>
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
