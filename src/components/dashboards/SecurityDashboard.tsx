import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '@/lib/apiClient';
import { getStorageSignedUrl, listStorageFiles, removeStorageFiles, uploadToStorage } from '@/lib/storageClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityInsightsMini } from '@/components/ActivityInsightsMini';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, FileCheck, AlertCircle, Upload, ClipboardCheck, Eye, Car, Clock, File, Trash2, Phone, User, Truck, AlertTriangle, Zap, TrendingUp, ArrowRight, TimerReset, Activity } from 'lucide-react';
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
import IncomingVehiclesPanel from '@/components/IncomingVehiclesPanel';

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
  const [viewFilter, setViewFilter] = useState<'all' | 'active' | 'completed' | 'total' | 'in_progress' | 'license_ok' | 'pending_verification'>('all');
  const drivesSectionRef = useRef<HTMLDivElement>(null);
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

  const pendingCount = testDrives.filter((d) => d.customers?.driving_license_url && !d.customers?.driving_license_verified).length;

  // ── AI-derived smart metrics ──────────────────────────────────────────────
  const metrics = useMemo(() => {
    const now = new Date();
    const active   = testDrives.filter((d) => !['completed','cancelled'].includes(d.status));
    const inProgress = testDrives.filter((d) => d.status === 'in_progress');
    const noLicense  = testDrives.filter((d) => !d.customers?.driving_license_url && !['completed','cancelled'].includes(d.status));
    const pendingInspection = testDrives.filter(
      (d) => d.key_handed_at && !(d as any).pre_drive_km && !d.security_checked_in_at && !['completed','cancelled'].includes(d.status)
    );
    const overdueReturn = inProgress.filter((d) => {
      if (!d.scheduled_date || !d.scheduled_time) return false;
      const scheduled = new Date(`${d.scheduled_date}T${d.scheduled_time}`);
      const slotDur = Number((d as any).slot_duration_minutes || 30);
      return now.getTime() > scheduled.getTime() + slotDur * 60_000 + 15 * 60_000;
    });
    const awaitingKey = testDrives.filter((d) => !d.key_handed_at && !['completed','cancelled'].includes(d.status));
    const completedToday = testDrives.filter((d) => d.status === 'completed' && d.security_checked_out_at?.startsWith(now.toISOString().split('T')[0]));

    // Compliance rate: drives with verified license / total active
    const complianceRate = active.length > 0
      ? Math.round((active.filter((d) => d.customers?.driving_license_verified).length / active.length) * 100)
      : 100;

    // Action items — ordered by urgency
    const actions: { id: string; type: 'critical'|'warning'|'info'; icon: any; title: string; description: string; count: number; path?: string }[] = [];
    if (overdueReturn.length > 0) actions.push({ id: 'overdue', type: 'critical', icon: TimerReset, title: 'Overdue Returns', description: `${overdueReturn.length} drive${overdueReturn.length > 1 ? 's' : ''} past scheduled return time`, count: overdueReturn.length });
    if (pendingCount > 0) actions.push({ id: 'license', type: 'critical', icon: FileCheck, title: 'License Verification Required', description: `${pendingCount} customer license${pendingCount > 1 ? 's' : ''} awaiting your review`, count: pendingCount });
    if (noLicense.length > 0) actions.push({ id: 'nolicense', type: 'warning', icon: AlertTriangle, title: 'Missing Driving License', description: `${noLicense.length} active drive${noLicense.length > 1 ? 's' : ''} with no license uploaded`, count: noLicense.length });
    if (pendingInspection.length > 0) actions.push({ id: 'inspect', type: 'warning', icon: ClipboardCheck, title: 'Pre-Drive Inspection Pending', description: `${pendingInspection.length} drive${pendingInspection.length > 1 ? 's' : ''} with key handed — inspection needed`, count: pendingInspection.length });
    if (awaitingKey.length > 0) actions.push({ id: 'key', type: 'info', icon: Car, title: 'Awaiting Key Handover', description: `${awaitingKey.length} drive${awaitingKey.length > 1 ? 's' : ''} waiting for sales to assign vehicle`, count: awaitingKey.length });

    return { active, inProgress, overdueReturn, noLicense, pendingInspection, awaitingKey, completedToday, complianceRate, actions };
  }, [testDrives, pendingCount]);

  const filteredDrives = testDrives.filter((drive) => {
    if (viewFilter === 'completed') return drive.status === 'completed';
    if (viewFilter === 'active') return drive.status !== 'completed' && drive.status !== 'cancelled';
    if (viewFilter === 'total') return true;
    if (viewFilter === 'in_progress') return drive.status === 'in_progress';
    if (viewFilter === 'license_ok') return !!drive.customers?.driving_license_verified;
    if (viewFilter === 'pending_verification') return !!drive.customers?.driving_license_url && !drive.customers?.driving_license_verified;
    return true;
  });

  const filterLabels: Record<string, string> = {
    all: 'All Records', active: 'Active Only', completed: 'Completed',
    total: 'Total Today', in_progress: 'In Progress', license_ok: 'License Verified', pending_verification: 'Pending Verification',
  };

  const handleStatClick = (filter: typeof viewFilter) => {
    setViewFilter(filter);
    setTimeout(() => drivesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Urgency colour for a drive card
  const getDriveUrgency = (d: any): 'critical' | 'warning' | 'ok' | 'neutral' => {
    if (metrics.overdueReturn.some((r) => r.id === d.id)) return 'critical';
    if (!d.customers?.driving_license_verified && !['completed','cancelled'].includes(d.status)) return 'warning';
    if (d.status === 'in_progress') return 'ok';
    return 'neutral';
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Security Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time safety, compliance & vehicle management</p>
        </div>
        {/* Live compliance badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
          metrics.complianceRate >= 90 ? 'bg-success/10 border-success/30 text-success'
          : metrics.complianceRate >= 70 ? 'bg-warning/10 border-warning/30 text-warning'
          : 'bg-destructive/10 border-destructive/30 text-destructive'
        }`}>
          <Activity className="h-3.5 w-3.5" />
          Compliance {metrics.complianceRate}%
        </div>
      </div>

      {/* ── KPI stat strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Today', value: testDrives.length, icon: Shield, color: 'text-primary', bg: 'bg-primary/10', activeColor: 'ring-primary', sub: `${metrics.active.length} active`, filter: 'total' as const },
          { label: 'In Progress', value: metrics.inProgress.length, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', activeColor: 'ring-success', sub: metrics.overdueReturn.length > 0 ? `${metrics.overdueReturn.length} overdue` : 'on track', alert: metrics.overdueReturn.length > 0, filter: 'in_progress' as const },
          { label: 'License OK', value: testDrives.filter((d) => d.customers?.driving_license_verified).length, icon: FileCheck, color: 'text-info', bg: 'bg-info/10', activeColor: 'ring-info', sub: `${pendingCount} pending`, filter: 'license_ok' as const },
          { label: 'Pending Verification', value: pendingCount, icon: AlertCircle, color: pendingCount > 0 ? 'text-warning' : 'text-muted-foreground', bg: pendingCount > 0 ? 'bg-warning/10' : 'bg-muted/40', activeColor: 'ring-warning', sub: pendingCount > 0 ? 'needs action' : 'all clear', alert: pendingCount > 0, filter: 'pending_verification' as const },
        ].map((stat) => {
          const Icon = stat.icon;
          const isActive = viewFilter === stat.filter;
          return (
            <Card
              key={stat.label}
              className={`shadow-card cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 select-none
                ${(stat as any).alert ? 'border-warning/30' : ''}
                ${isActive ? `ring-2 ${stat.activeColor} border-transparent` : ''}`}
              onClick={() => handleStatClick(stat.filter)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl ${stat.bg} flex items-center justify-center shrink-0 relative`}>
                    <Icon className={`h-4.5 w-4.5 ${stat.color}`} />
                    {(stat as any).alert && !isActive && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-warning text-warning-foreground text-[9px] font-bold flex items-center justify-center">
                        {stat.value}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-heading font-bold leading-none text-foreground">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{stat.label}</p>
                    <p className={`text-[10px] mt-0.5 ${(stat as any).alert ? 'text-warning font-medium' : 'text-muted-foreground/70'}`}>{stat.sub}</p>
                  </div>
                </div>
                {isActive && (
                  <div className="mt-2 pt-1.5 border-t border-border flex items-center gap-1 text-[10px] text-primary font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Showing filtered results
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
 <Card className="flex gap-2 bg-transparent border-0 p-0">
      {/* ── Smart action queue ── */}
      {metrics.actions.length > 0 && (
        <Card className="w-1/2 shadow-card border-l-4 border-l-destructive/60">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="font-heading text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-destructive" />
              Action Required
              <Badge className="ml-1 bg-destructive/15 text-destructive text-[10px] border-0">{metrics.actions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-2">
              {metrics.actions.map((action) => {
                const Icon = action.icon;
                return (
                  <div
                    key={action.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                      action.type === 'critical' ? 'bg-destructive/5 border-destructive/20'
                      : action.type === 'warning' ? 'bg-warning/5 border-warning/20'
                      : 'bg-info/5 border-info/20'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                      action.type === 'critical' ? 'bg-destructive/15' : action.type === 'warning' ? 'bg-warning/15' : 'bg-info/15'
                    }`}>
                      <Icon className={`h-3.5 w-3.5 ${action.type === 'critical' ? 'text-destructive' : action.type === 'warning' ? 'text-warning' : 'text-info'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold ${action.type === 'critical' ? 'text-destructive' : action.type === 'warning' ? 'text-warning' : 'text-info'}`}>
                        {action.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{action.description}</p>
                    </div>
                    <Badge className={`shrink-0 text-[11px] font-bold ${
                      action.type === 'critical' ? 'bg-destructive text-destructive-foreground'
                      : action.type === 'warning' ? 'bg-warning text-warning-foreground'
                      : 'bg-info text-white'
                    }`}>{action.count}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Incoming Shared Vehicles ── */}
      {profile?.location_id && profile?.id && (
        <div className=" w-1/2  rounded-xl border border-info/25 bg-gradient-to-br from-info/5 via-background to-background shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-info/15">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-info/15 flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4 text-info" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground">Incoming Shared Vehicles</h3>
                <p className="text-[11px] text-muted-foreground">Vehicles dispatched to your location</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-7 border-info/30 text-info hover:bg-info/10 gap-1.5" onClick={() => navigate('/incoming-vehicles')}>
              <ArrowRight className="h-3 w-3" /> Full View
            </Button>
          </div>
          <div className="px-4 py-3">
            <IncomingVehiclesPanel locationId={profile.location_id} profileId={profile.id} />
          </div>
        </div>
      )}
</Card>
      {/* ── Activity Insights ── */}
      <ActivityInsightsMini />

      {/* ── Security SOP ── */}
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Security SOP
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {[
              { n: 1, text: 'Verify License Before Vehicle Movement.' },
              { n: 2, text: 'Complete Pre-Drive Inspection, Then Start In Progress.' },
              { n: 3, text: 'Upon Return, Submit Post-Drive Inspection.' },
              { n: 4, text: 'Return And Handover To Close The Drive.' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-2 rounded-md bg-muted/40 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                <span className="text-muted-foreground">{s.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Test Drives ── */}
      <Card className="shadow-card" ref={drivesSectionRef}>
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" /> Test Drives
              {viewFilter !== 'all' && (
                <Badge className="ml-1 bg-primary/10 text-primary text-[10px] border-0 font-normal">
                  {filterLabels[viewFilter]}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {viewFilter !== 'all' && (
                <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => setViewFilter('all')}>
                  × Clear
                </Button>
              )}
              <Select value={['all','active','completed'].includes(viewFilter) ? viewFilter : 'all'} onValueChange={(v: 'all' | 'active' | 'completed') => setViewFilter(v)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5">
            {filteredDrives.slice(0, 5).map((testDrive) => {
              const urgency = getDriveUrgency(testDrive);
              const urgencyBar = urgency === 'critical' ? 'border-l-destructive' : urgency === 'warning' ? 'border-l-warning' : urgency === 'ok' ? 'border-l-success' : 'border-l-border';
              return (
              <div
                key={testDrive.id}
                className={`p-3 rounded-lg border border-border border-l-4 ${urgencyBar} bg-card/50 space-y-2.5 cursor-pointer hover:bg-muted/30 transition-colors`}
                onClick={() => setDetailSheetDrive(testDrive)}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{testDrive.customers?.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" /> {testDrive.profiles?.full_name || 'Unassigned'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        testDrive.status === 'completed' ? 'bg-success/10 text-success'
                        : testDrive.status === 'key_handover_to_sales' ? 'bg-warning/10 text-warning'
                        : testDrive.status === 'in_progress' ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {formatStatusLabel(testDrive.status)}
                    </Badge>
                    {urgency === 'critical' && <span className="text-[9px] font-bold text-destructive uppercase tracking-wide">Overdue</span>}
                  </div>
                </div>

                {/* Vehicle + time */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Car className="h-3 w-3" />{testDrive.vehicles?.brand} {testDrive.vehicles?.model}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{testDrive.scheduled_date} {(testDrive.scheduled_time || '').substring(0, 5)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  {!testDrive.security_checked_in_at ? (
                    !testDrive.key_handed_at ? (
                      <Badge className="bg-muted text-muted-foreground text-xs">Awaiting Key</Badge>
                    ) : !testDrive.customers?.driving_license_verified ? (
                      <Badge className="bg-warning/10 text-warning text-xs">Verify License First</Badge>
                    ) : !(testDrive as any).pre_drive_km || !(testDrive as any).pre_drive_fuel_level ? (
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => { setPendingStartDriveId(testDrive.id); openInspection(testDrive, 'pre'); }}>
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Pre-Drive & Start
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
                        <Badge className="bg-warning/10 text-warning text-xs">Awaiting Vehicle</Badge>
                      )}
                    </div>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground text-xs">Checked Out</Badge>
                  )}
                </div>

                {/* License */}
                <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  {testDrive.customers?.driving_license_url ? (
                    testDrive.customers?.driving_license_verified ? (
                      <Badge className="bg-success/10 text-success text-xs">License Verified</Badge>
                    ) : (
                      <>
                        <Badge className="bg-warning/10 text-warning text-xs">Verify Pending</Badge>
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

                {/* KM + inspection */}
                <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border" onClick={e => e.stopPropagation()}>
                  {(testDrive as any).pre_drive_km && <Badge className="bg-primary/10 text-primary text-xs">Pre: {(testDrive as any).pre_drive_km} km</Badge>}
                  {(testDrive as any).post_drive_km && <Badge className="bg-success/10 text-success text-xs">Post: {(testDrive as any).post_drive_km} km</Badge>}
                  {((testDrive as any).pre_drive_km || (testDrive as any).post_drive_km) && (
                    <Button size="sm" className="bg-muted text-foreground hover:bg-muted/80 text-xs" onClick={() => setInspectionViewDrive(testDrive)}>
                      <Eye className="h-3 w-3 mr-1" /> Details
                    </Button>
                  )}
                  {(testDrive as any).inspection_submitted_at && <Badge className="bg-muted text-muted-foreground text-xs">Complete</Badge>}
                  <Label htmlFor={`doc-upload-${testDrive.id}`} className="cursor-pointer ml-auto">
                    <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs" asChild>
                      <span><Upload className="h-3 w-3 mr-1" /> Doc</span>
                    </Button>
                  </Label>
                  <input id={`doc-upload-${testDrive.id}`} type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingDocId === testDrive.id}
                    onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadTestDriveDoc(testDrive.id, file); }} />
                </div>

                {/* Docs */}
                {testDriveDocuments[testDrive.id]?.length > 0 && (
                  <div className="pt-1.5 border-t border-border" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Documents</p>
                    <div className="flex flex-wrap gap-1">
                      {testDriveDocuments[testDrive.id].map((doc: any, index: number) => (
                        <div key={index} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted">
                          <File className="h-3 w-3" />
                          <button className="text-primary hover:underline" onClick={() => void viewDocument(testDrive.id, doc.name)}>
                            {doc.name.split('/').pop()?.substring(0, 18)}…
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
            );
            })}
            </div>
            {filteredDrives.length > 5 && (
              <div className="flex justify-center pt-3">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/test-drives')}>
                  View All {filteredDrives.length} Test Drives <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
            {filteredDrives.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No test drives for selected filter</p>}
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
