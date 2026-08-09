import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiDbQuery, apiPatch, apiPost } from '@/lib/apiClient';
import { sendTransactionalEmail } from '@/lib/functionService';
import { getStorageSignedUrl, listStorageFiles, uploadToStorage } from '@/lib/storageClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityInsightsMini } from '@/components/ActivityInsightsMini';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, Upload, FileCheck, ArrowRightLeft, RotateCcw, Key, Eye, ClipboardCheck, Car, Clock, Phone, UserCog, CalendarClock, ShieldCheck, AlertTriangle, TrendingUp, Filter, CheckSquare, CreditCard, Banknote, Link2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SalesSwapDialog from './SalesSwapDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { logStaffActivity } from '@/lib/activityLogger';
import { APP_ROLE } from '@/constants/roles';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';

type LeadTemperature = 'hot' | 'cold';

const SalesDashboard = () => {
  const { user, profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [securityEventsByDrive, setSecurityEventsByDrive] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [swapDrive, setSwapDrive] = useState<any>(null);
  const [reassignDrive, setReassignDrive] = useState<any>(null);
  const [rescheduleDrive, setRescheduleDrive] = useState<any>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'security' | 'status'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [inspectionViewDrive, setInspectionViewDrive] = useState<any>(null);
  const [inspectionDocsByDrive, setInspectionDocsByDrive] = useState<Record<string, any[]>>({});
  const [inspectionDocView, setInspectionDocView] = useState<{ url: string; filename: string } | null>(null);
  const [securityContacts, setSecurityContacts] = useState<Array<{ id: string; full_name: string; phone: string | null }>>([]);
  const [completionLeadDialogDrive, setCompletionLeadDialogDrive] = useState<any>(null);
  const [completionStep, setCompletionStep] = useState<1 | 2>(1);
  const [leadTemperature, setLeadTemperature] = useState<LeadTemperature>('cold');
  const [followUpTaskTitle, setFollowUpTaskTitle] = useState('');
  const [followUpTaskDueAt, setFollowUpTaskDueAt] = useState('');
  const [presetHandoverQuestions, setPresetHandoverQuestions] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [salesOpportunities, setSalesOpportunities] = useState<any[]>([]);
  const [salesTasks, setSalesTasks] = useState<any[]>([]);
  const [oppNotesDialog, setOppNotesDialog] = useState<{ open: boolean; opportunityId: string | null }>({ open: false, opportunityId: null });
  const [oppNoteText, setOppNoteText] = useState('');
  const [oppFollowUpDueAt, setOppFollowUpDueAt] = useState('');
  const [taskNotesDialog, setTaskNotesDialog] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [taskNoteText, setTaskNoteText] = useState('');
  // Booking state (hot lead)
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<'cash' | 'payment_link'>('cash');
  const [bookingAmount, setBookingAmount] = useState('');
  const [bookingPaymentLink, setBookingPaymentLink] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingCreating, setBookingCreating] = useState(false);
  const notifiedHandoverIdsRef = useRef<Set<string>>(new Set());
  const [detailSheetDrive, setDetailSheetDrive] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Pending';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Pending';
    return parsed.toLocaleString();
  };

  const getJourneyDurationMinutes = (td: any, completedAtOverride?: string) => {
    const start = td.security_checked_in_at || td.started_at || td.key_handed_at;
    const end = td.security_checked_out_at || td.completed_at || completedAtOverride;
    if (!start || !end) return null;

    const startAt = new Date(start).getTime();
    const endAt = new Date(end).getTime();
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt < startAt) return null;

    return Math.max(1, Math.round((endAt - startAt) / 60000));
  };

  const buildTraceabilityMessage = (td: any, completedAtOverride?: string) => {
    const vehicleName = `${td.vehicles?.brand || ''} ${td.vehicles?.model || ''}`.trim() || 'your selected vehicle';
    const locationName = td.locations?.name || 'our showroom';
    const securityMeta = securityEventsByDrive[td.id] || {};
    const securityLogs = securityMeta.logs || [];

    const preInspectionLog = securityLogs.find((log: any) => log.eventType === 'vehicle_inspection_pre');
    const postInspectionLog = securityLogs.find((log: any) => log.eventType === 'vehicle_inspection_post');
    const checkInLog = securityLogs.find((log: any) => log.eventType === 'test_drive_check_in');
    const checkOutLog = securityLogs.find((log: any) => log.eventType === 'test_drive_check_out');

    const preKm = (td as any).pre_drive_km;
    const postKm = (td as any).post_drive_km;
    const hasDistance = Number.isFinite(preKm) && Number.isFinite(postKm);
    const distanceDriven = hasDistance ? Math.max(0, Number(postKm) - Number(preKm)) : null;

    const journeyDurationMinutes = getJourneyDurationMinutes(td, completedAtOverride);

    const lines = [
      `Your test drive for ${vehicleName} at ${locationName} is now completed.`,
      '',
      'End-to-End Journey Traceability:',
      `1. Customer reached showroom: ${formatDateTime(td.security_checked_in_at || checkInLog?.happenedAt)}${securityMeta.checkInBy ? ` (verified by ${securityMeta.checkInBy})` : ''}`,
      `2. Key assigned / vehicle handover by sales: ${formatDateTime(td.key_handed_at)}`,
      `3. Security started drive process: ${formatDateTime(td.started_at || td.security_checked_in_at || checkInLog?.happenedAt)}`,
      `4. Pre-inspection started: ${formatDateTime(preInspectionLog?.happenedAt)}${preInspectionLog?.by ? ` (by ${preInspectionLog.by})` : ''}`,
      `5. Post-inspection completed: ${formatDateTime(postInspectionLog?.happenedAt)}${postInspectionLog?.by ? ` (by ${postInspectionLog.by})` : ''}`,
      `6. Vehicle returned / checkout at security: ${formatDateTime(td.security_checked_out_at || checkOutLog?.happenedAt)}${securityMeta.completedBy ? ` (by ${securityMeta.completedBy})` : securityMeta.checkOutBy ? ` (by ${securityMeta.checkOutBy})` : ''}`,
      `7. Sales marked completion: ${formatDateTime(completedAtOverride || td.completed_at)}`,
      `8. Total showroom journey time: ${journeyDurationMinutes ? `${journeyDurationMinutes} minutes` : 'Not available'}`,
      '',
      'Inspection Summary:',
      `- Pre KM: ${preKm ?? 'N/A'}`,
      `- Pre Fuel: ${(td as any).pre_drive_fuel_level || 'N/A'}`,
      `- Post KM: ${postKm ?? 'N/A'}`,
      `- Post Fuel: ${(td as any).post_drive_fuel_level || 'N/A'}`,
      `- Distance driven: ${distanceDriven !== null ? `${distanceDriven.toFixed(1)} km` : 'N/A'}`,
      `- Pre scratches: ${(td as any).pre_drive_scratches || 'None reported'}`,
      `- Post scratches: ${(td as any).post_drive_scratches || 'None reported'}`,
      `- Pre notes: ${(td as any).pre_drive_notes || 'N/A'}`,
      `- Post notes: ${(td as any).post_drive_notes || 'N/A'}`,
      '',
      'Please connect with your sales team for pricing, offers, and next steps.',
      'Thank you for visiting us.',
    ];

    return lines.join('\n');
  };

  useEffect(() => {
    fetchAssignedDrives();
  }, [user]);

  useEffect(() => {
    void fetchLeadWorkspace();
  }, [profile?.id]);

  useTestDriveRealtime(profile?.location_id, () => {
    void fetchAssignedDrives();
  });

  const fetchAssignedDrives = async () => {
    if (!profile?.id) return;
    const enrichedDrives = await apiGet<any[]>(`/api/test-drives?sales_person_id=${encodeURIComponent(profile.id)}`) || [];
    setTestDrives(enrichedDrives);

    const profileLocationIds = Array.from(new Set(enrichedDrives.map((drive: any) => drive.location_id).filter(Boolean)));
    if (profileLocationIds.length > 0) {
      const [securityProfiles, securityRoles] = await Promise.all([
        apiGet<any[]>(`/api/profiles?location_ids=${encodeURIComponent(profileLocationIds.join(','))}&is_active=true`),
        apiGet<any[]>('/api/user-roles?role=security'),
      ]);

      const securityUserIds = new Set((securityRoles || []).map((row: any) => row.user_id));
      const uniqueContacts = (securityProfiles || [])
        .filter((profileRow: any) => securityUserIds.has(profileRow.user_id))
        .reduce((acc: Array<{ id: string; full_name: string; phone: string | null }>, profileRow: any) => {
          if (!acc.some((entry) => entry.id === profileRow.id)) {
            acc.push({ id: profileRow.id, full_name: profileRow.full_name, phone: profileRow.phone || null });
          }
          return acc;
        }, []);

      setSecurityContacts(uniqueContacts);
    } else {
      setSecurityContacts([]);
    }

    if (enrichedDrives.length > 0) {
      await Promise.all(
        enrichedDrives.map(async (drive) => {
          const docs = await listStorageFiles('documents', `test-drives/${drive.id}`, 200);
          setInspectionDocsByDrive((prev) => ({ ...prev, [drive.id]: docs || [] }));
        })
      );
    } else {
      setInspectionDocsByDrive({});
    }

    if (!enrichedDrives.length) {
      setSecurityEventsByDrive({});
      return;
    }

    const driveIds = new Set(enrichedDrives.map((d) => d.id));
    const securityEvents = await apiGet<any[]>(
      `/api/activity/events?role=security&event_types=${encodeURIComponent('test_drive_check_in,test_drive_check_out,test_drive_completed,vehicle_inspection_pre,vehicle_inspection_post,license_verified')}&limit=1000`
    );

    const activityProfileIds = Array.from(new Set((securityEvents || []).map((event: any) => event.profile_id).filter(Boolean)));
    const eventProfiles = activityProfileIds.length
      ? await apiGet<any[]>(`/api/profiles?ids=${encodeURIComponent(activityProfileIds.join(','))}`)
      : [];
    const profileNameMap = new Map((eventProfiles || []).map((row: any) => [row.id, row.full_name]));

    const perDrive: Record<string, any> = {};
    for (const event of securityEvents || []) {
      const testDriveId = (event as any)?.metadata?.testDriveId;
      if (!testDriveId || !driveIds.has(testDriveId)) continue;

      const fullName = profileNameMap.get((event as any)?.profile_id) || 'Security';
      if (!perDrive[testDriveId]) perDrive[testDriveId] = { logs: [] };

      perDrive[testDriveId].logs.push({
        eventType: (event as any).event_type,
        label: (event as any).event_label || (event as any).event_type,
        happenedAt: (event as any).happened_at,
        by: fullName,
      });

      if ((event as any).event_type === 'test_drive_check_in' && !perDrive[testDriveId].checkInAt) {
        perDrive[testDriveId].checkInAt = (event as any).happened_at;
        perDrive[testDriveId].checkInBy = fullName;
      }
      if ((event as any).event_type === 'test_drive_check_out' && !perDrive[testDriveId].checkOutAt) {
        perDrive[testDriveId].checkOutAt = (event as any).happened_at;
        perDrive[testDriveId].checkOutBy = fullName;
      }
      if ((event as any).event_type === 'test_drive_completed' && !perDrive[testDriveId].completedAt) {
        perDrive[testDriveId].completedAt = (event as any).happened_at;
        perDrive[testDriveId].completedBy = fullName;
      }
    }

    setSecurityEventsByDrive(perDrive);

    const keyHandoverDrives = enrichedDrives.filter((drive: any) => drive.status === 'key_handover_to_sales');
    keyHandoverDrives.forEach((drive: any) => {
      if (notifiedHandoverIdsRef.current.has(drive.id)) return;
      notifiedHandoverIdsRef.current.add(drive.id);
      const customerName = drive?.customers?.full_name || 'Customer';
      toast({
        title: 'Key handover to sales',
        description: `Please take follow up from Mr. ${customerName} and close the drive.`,
      });
    });
  };

  const fetchLeadWorkspace = async () => {
    if (!profile?.id) return;

    try {
      const [opportunities, tasks] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'sales_opportunities',
          action: 'select',
          select: 'id, customer_id, latest_test_drive_id, temperature, stage, updated_at, notes, owner_profile_id, location_id',
          filters: [{ field: 'owner_profile_id', op: 'eq', value: profile.id }],
          order: [{ field: 'updated_at', ascending: false }],
          limit: 50,
        }),
        apiDbQuery<any[]>({
          table: 'sales_tasks',
          action: 'select',
          select: 'id, title, due_at, status, priority, test_drive_id, created_at, customer_id, assigned_to_profile_id, opportunity_id',
          filters: [
            { field: 'assigned_to_profile_id', op: 'eq', value: profile.id },
            { field: 'status', op: 'eq', value: 'open' },
          ],
          order: [{ field: 'due_at', ascending: true }],
          limit: 50,
        }),
      ]);

      const oppCustomerIds = Array.from(new Set((opportunities || []).map((opp: any) => opp.customer_id).filter(Boolean)));
      const oppDriveIds = Array.from(new Set((opportunities || []).map((opp: any) => opp.latest_test_drive_id).filter(Boolean)));
      const taskCustomerIds = Array.from(new Set((tasks || []).map((task: any) => task.customer_id).filter(Boolean)));
      const allCustomerIds = Array.from(new Set([...oppCustomerIds, ...taskCustomerIds]));

      const [customers, latestDrives] = await Promise.all([
        allCustomerIds.length
          ? apiGet<any[]>(`/api/customers?ids=${encodeURIComponent(allCustomerIds.join(','))}`)
          : Promise.resolve([]),
        oppDriveIds.length
          ? apiGet<any[]>(`/api/test-drives?ids=${encodeURIComponent(oppDriveIds.join(','))}`)
          : Promise.resolve([]),
      ]);

      const customerMap = new Map((customers || []).map((row: any) => [row.id, row]));
      const driveMap = new Map((latestDrives || []).map((row: any) => [row.id, row]));

      const seenOppCombo = new Set<string>();
      const uniqueOpportunities = (opportunities || []).filter((opp: any) => {
        const key = `${opp.customer_id}-${opp.latest_test_drive_id}`;
        if (seenOppCombo.has(key)) return false;
        seenOppCombo.add(key);
        return true;
      }).slice(0, 12).map((opp: any) => {
        const drive = driveMap.get(opp.latest_test_drive_id);
        return {
          ...opp,
          customers: customerMap.get(opp.customer_id) || null,
          test_drives: drive
            ? {
                id: drive.id,
                scheduled_date: drive.scheduled_date,
                vehicles: drive.vehicles || null,
              }
            : null,
        };
      });
      setSalesOpportunities(uniqueOpportunities);

      const seenTaskCombo = new Set<string>();
      const uniqueTasks = (tasks || []).filter((task: any) => {
        const key = `${task.test_drive_id}-${task.title}`;
        if (seenTaskCombo.has(key)) return false;
        seenTaskCombo.add(key);
        return true;
      }).slice(0, 12).map((task: any) => ({
        ...task,
        customers: customerMap.get(task.customer_id) || null,
      }));
      setSalesTasks(uniqueTasks);
    } catch {
      setSalesOpportunities([]);
      setSalesTasks([]);
    }
  };

  const upsertOpportunityAndTask = async (
    td: any,
    completedAt: string,
    selectedTemperature: LeadTemperature,
    taskTitle: string,
    taskDueAt?: string
  ) => {
    if (!profile?.id || !td?.customer_id) return;

    const stage = selectedTemperature === 'hot' ? 'qualified' : 'new';
    const statusNote = `[${new Date().toLocaleString()}] Lead marked ${selectedTemperature.toUpperCase()} after test drive completion.`;

    const existingOppRows = await apiDbQuery<any[]>({
      table: 'sales_opportunities',
      action: 'select',
      select: 'id, notes',
      filters: [
        { field: 'customer_id', op: 'eq', value: td.customer_id },
        { field: 'owner_profile_id', op: 'eq', value: profile.id },
        { field: 'location_id', op: 'eq', value: td.location_id },
        { field: 'stage', op: 'not_in', value: ['won', 'lost'] },
      ],
      order: [{ field: 'updated_at', ascending: false }],
      limit: 1,
    });
    const existingOpportunity = existingOppRows?.[0] || null;

    let opportunityId: string;
    if (existingOpportunity?.id) {
      const mergedNotes = `${existingOpportunity.notes || ''}\n${statusNote}`.trim();
      await apiDbQuery({
        table: 'sales_opportunities',
        action: 'update',
        payload: {
          latest_test_drive_id: td.id,
          temperature: selectedTemperature,
          stage,
          notes: mergedNotes,
          updated_at: completedAt,
        },
        filters: [{ field: 'id', op: 'eq', value: existingOpportunity.id }],
      });
      opportunityId = existingOpportunity.id;
    } else {
      const insertedOpportunity = await apiDbQuery<any>({
        table: 'sales_opportunities',
        action: 'insert',
        select: 'id',
        payload: {
          customer_id: td.customer_id,
          latest_test_drive_id: td.id,
          location_id: td.location_id,
          owner_profile_id: profile.id,
          temperature: selectedTemperature,
          stage,
          notes: statusNote,
        },
      });
      const row = Array.isArray(insertedOpportunity) ? insertedOpportunity[0] : insertedOpportunity;
      if (!row?.id) throw new Error('Unable to create opportunity');
      opportunityId = row.id;
    }

    const finalTaskTitle = (taskTitle || '').trim() || (selectedTemperature === 'hot'
      ? 'Call customer for booking amount and finance options'
      : 'Follow up after test drive and capture objections');

    const dueAt = taskDueAt
      ? new Date(taskDueAt).toISOString()
      : new Date(Date.now() + (selectedTemperature === 'hot' ? 24 : 72) * 60 * 60 * 1000).toISOString();

    // Check if task already exists for this test drive to prevent duplicates
    const existingTasks = await apiDbQuery<any[]>({
      table: 'sales_tasks',
      action: 'select',
      select: 'id',
      filters: [
        { field: 'test_drive_id', op: 'eq', value: td.id },
        { field: 'assigned_to_profile_id', op: 'eq', value: profile.id },
        { field: 'status', op: 'eq', value: 'open' },
      ],
      limit: 1,
    });
    const existingTask = existingTasks?.[0] || null;

    // Only insert task if it doesn't already exist
    if (!existingTask?.id) {
      await apiDbQuery({
        table: 'sales_tasks',
        action: 'insert',
        values: {
          opportunity_id: opportunityId,
          test_drive_id: td.id,
          customer_id: td.customer_id,
          assigned_to_profile_id: profile.id,
          title: finalTaskTitle,
          due_at: dueAt,
          status: 'open',
          priority: selectedTemperature === 'hot' ? 'high' : 'medium',
        },
      });
    }
  };

  const handleSaveOppNote = async () => {
    if (!oppNotesDialog.opportunityId || !oppNoteText.trim()) return;

    try {
      const oppRows = await apiDbQuery<any[]>({
        table: 'sales_opportunities',
        action: 'select',
        select: 'notes, customer_id',
        filters: [{ field: 'id', op: 'eq', value: oppNotesDialog.opportunityId }],
        limit: 1,
      });
      const opp = oppRows?.[0] || null;

      const timestamp = new Date().toLocaleString();
      const newNote = `[${timestamp}] ${oppNoteText.trim()}`;
      const updatedNotes = opp?.notes ? `${opp.notes}\n\n${newNote}` : newNote;

      await apiDbQuery({
        table: 'sales_opportunities',
        action: 'update',
        payload: { notes: updatedNotes },
        filters: [{ field: 'id', op: 'eq', value: oppNotesDialog.opportunityId }],
      });

      if (oppFollowUpDueAt.trim()) {
        const dueAt = new Date(oppFollowUpDueAt);
        if (!Number.isNaN(dueAt.getTime()) && profile?.id) {
          await apiDbQuery({
            table: 'sales_tasks',
            action: 'insert',
            values: {
              opportunity_id: oppNotesDialog.opportunityId,
              customer_id: opp?.customer_id || null,
              assigned_to_profile_id: profile.id,
              title: 'Follow-up after review note',
              due_at: dueAt.toISOString(),
              status: 'open',
              priority: 'medium',
            },
          });
        }
      }

      toast({ title: 'Note added successfully' });
      setOppNotesDialog({ open: false, opportunityId: null });
      setOppNoteText('');
      setOppFollowUpDueAt('');
      void fetchLeadWorkspace();
    } catch (err: any) {
      toast({ title: 'Failed to save note', description: err.message, variant: 'destructive' });
    }
  };

  const handleSaveTaskNote = async () => {
    if (!taskNotesDialog.taskId || !taskNoteText.trim()) return;

    try {
        toast({ title: 'Task notes feature not available', description: 'Notes are currently only available for opportunities.', variant: 'default' });
        setTaskNotesDialog({ open: false, taskId: null });
        setTaskNoteText('');
    } catch (err: any) {
      toast({ title: 'Failed to save note', description: err.message, variant: 'destructive' });
    }
  };

  const viewInspectionMedia = async (testDriveId: string, filename: string) => {
    const signedUrl = await getStorageSignedUrl('documents', `test-drives/${testDriveId}/${filename}`, 300);
    if (!signedUrl) {
      toast({ title: 'Failed to open media', description: 'Unable to generate preview URL', variant: 'destructive' });
      return;
    }
    setInspectionDocView({ url: signedUrl, filename });
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
      await uploadToStorage('documents', path, file);
      await apiPatch(`/api/customers/${encodeURIComponent(customerId)}`, { driving_license_url: path });
      toast({ title: 'License uploaded successfully' });
      fetchAssignedDrives();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleGiveKeyAndStart = async (id: string) => {
    await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { key_handed_at: new Date().toISOString() });
    if (user?.id) {
      await logStaffActivity({
        userId: user.id,
        profileId: profile?.id,
        locationId: profile?.location_id,
        role: 'sales',
        eventType: 'test_drive_started',
        label: 'Assigned vehicle and handed over key',
        metadata: { testDriveId: id },
      });
    }
    toast({ title: 'Vehicle assigned', description: 'Key handed over. Security will start drive at gate.' });
    fetchAssignedDrives();
  };

  const handleComplete = async (
    td: any,
    options?: { leadTemperature?: LeadTemperature; taskTitle?: string; taskDueAt?: string; handoverFeedback?: { questions: string[]; notes: string } }
  ) => {
    const id = td.id;
    const completedAt = new Date().toISOString();

    // Persist handover feedback into metadata if provided
    const feedbackPayload = options?.handoverFeedback && (
      options.handoverFeedback.questions.length > 0 || options.handoverFeedback.notes.trim()
    ) ? {
      status: 'completed',
      completed_at: completedAt,
      metadata: {
        ...(td.metadata || {}),
        handover_feedback: {
          questions: options.handoverFeedback.questions,
          notes: options.handoverFeedback.notes.trim(),
          recorded_at: completedAt,
        },
      },
    } : {
      status: 'completed',
      completed_at: completedAt,
    };

    await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, feedbackPayload as Record<string, unknown>);

    if (td?.customers?.email) {
      const customerName = td.customers.full_name || 'Customer';
      const message = buildTraceabilityMessage(td, completedAt);
      const surveyLink = 'https://survey.showroom-drive.com/feedback'; // Replace with actual survey link

      // Send follow-up email
      await sendTransactionalEmail({
          templateName: 'sales-follow-up',
          recipientEmail: td.customers.email,
          idempotencyKey: `test-drive-followup-${id}`,
          templateData: {
            customerName,
            message,
            surveyLink,
            thankYouMessage: 'Thank you for choosing us for your test drive experience!',
          },
      });

      // Send completed summary email
      let emailError: unknown = null;
      try {
        await sendTransactionalEmail({
          templateName: 'test-drive-completed',
          recipientEmail: td.customers.email,
          idempotencyKey: `test-drive-completed-${id}`,
          templateData: {
            customerName,
            vehicleName: `${td.vehicles?.brand || ''} ${td.vehicles?.model || ''}`.trim(),
            locationName: td.locations?.name || '',
            scheduledDate: td.scheduled_date,
            salesPersonName: profile?.full_name || '',
            durationMinutes: td.started_at && completedAt
              ? Math.round((new Date(completedAt).getTime() - new Date(td.started_at).getTime()) / 60000)
              : undefined,
          },
        });
      } catch (error) {
        emailError = error;
      }

      if (emailError) {
        toast({
          title: 'Completed, but email failed',
          description: 'Customer follow-up email could not be sent right now.',
          variant: 'destructive',
        });
      }
    }

    try {
      await upsertOpportunityAndTask(
        td,
        completedAt,
        options?.leadTemperature || 'cold',
        options?.taskTitle || '',
        options?.taskDueAt,
      );
    } catch (leadError: any) {
      toast({
        title: 'Lead/task update failed',
        description: leadError?.message || 'Opportunity and task were not saved.',
        variant: 'destructive',
      });
    }

    if (user?.id) {
      await logStaffActivity({
        userId: user.id,
        profileId: profile?.id,
        locationId: profile?.location_id,
        role: 'sales',
        eventType: 'test_drive_completed',
        label: 'Accepted key handover and closed test drive',
        metadata: { testDriveId: id, leadTemperature: options?.leadTemperature || 'cold' },
      });
    }
    toast({ title: 'Test drive completed', description: 'Lead and follow-up task created with traceability.' });
    fetchAssignedDrives();
    void fetchLeadWorkspace();
  };

  const handleReschedule = async () => {
    if (!rescheduleDrive?.id || !newDate || !newTime) return;

    await apiPatch(`/api/test-drives/${encodeURIComponent(rescheduleDrive.id)}`, {
      scheduled_date: newDate,
      scheduled_time: `${newTime}:00`,
      status: 'rescheduled',
      notes: `${rescheduleDrive.notes || ''}\n[${new Date().toLocaleString()}] Rescheduled by ${profile?.full_name || 'Sales'} to ${newDate} ${newTime}`.trim(),
    });

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
  const todayStr = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  })();
  const maxDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const handleCompleteWithLead = async () => {
    if (!completionLeadDialogDrive) return;
    const td = completionLeadDialogDrive;
    const isHotWithBooking = leadTemperature === 'hot' && bookingAmount && parseFloat(bookingAmount) > 0;

    await handleComplete(td, {
      leadTemperature,
      taskTitle: followUpTaskTitle,
      taskDueAt: followUpTaskDueAt || undefined,
      handoverFeedback: { questions: selectedQuestions, notes: handoverNotes },
    });

    if (isHotWithBooking) {
      await handleCreateBooking(undefined);
    }

    setCompletionLeadDialogDrive(null);
    setCompletionStep(1);
    setLeadTemperature('cold');
    setFollowUpTaskTitle('');
    setFollowUpTaskDueAt('');
    setSelectedQuestions([]);
    setHandoverNotes('');
    setPresetHandoverQuestions([]);
    setBookingPaymentMethod('cash');
    setBookingAmount('');
    setBookingPaymentLink('');
    setBookingNotes('');
  };

  const handleCreateBooking = async (opportunityId?: string) => {
    if (!completionLeadDialogDrive) return;
    const amount = parseFloat(bookingAmount);
    if (!bookingAmount || isNaN(amount) || amount <= 0) {
      toast({ title: 'Enter a valid booking amount', variant: 'destructive' }); return;
    }
    if (bookingPaymentMethod === 'payment_link' && !bookingPaymentLink.trim()) {
      toast({ title: 'Enter the payment link', variant: 'destructive' }); return;
    }
    setBookingCreating(true);
    try {
      const td = completionLeadDialogDrive;
      const inserted = await apiPost<any>('/api/car-bookings', {
        customer_id: td.customer_id,
        vehicle_id: td.vehicle_id,
        location_id: td.location_id,
        test_drive_id: td.id,
        opportunity_id: opportunityId || null,
        sales_person_profile_id: profile?.id || null,
        booking_status: 'confirmed',
        payment_method: bookingPaymentMethod,
        payment_status: bookingPaymentMethod === 'cash' ? 'paid' : 'pending',
        booking_amount: amount,
        payment_link: bookingPaymentMethod === 'payment_link' ? bookingPaymentLink.trim() : null,
        notes: bookingNotes.trim() || null,
      });
      const bookingId = inserted?.id;

      // Send booking confirmation email to customer
      if (td.customers?.email) {
        await sendTransactionalEmail({
          templateName: 'car-booking-confirmation',
          recipientEmail: td.customers.email,
          idempotencyKey: `car-booking-${bookingId || Date.now()}`,
          templateData: {
            customerName: td.customers.full_name || 'Customer',
            vehicleName: `${td.vehicles?.brand || ''} ${td.vehicles?.model || ''}`.trim(),
            bookingAmount: amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
            paymentMethod: bookingPaymentMethod === 'cash' ? 'Cash' : 'Payment Link',
            paymentLink: bookingPaymentMethod === 'payment_link' ? bookingPaymentLink.trim() : null,
            salesPersonName: profile?.full_name || '',
            locationName: td.locations?.name || '',
            bookingDate: new Date().toLocaleDateString(),
          },
        }).catch(() => null); // non-blocking
      }

      if (user?.id) {
        await logStaffActivity({
          userId: user.id,
          profileId: profile?.id,
          locationId: profile?.location_id,
          role: 'sales',
          eventType: 'car_booking_created',
          label: `Car booking created — ${td.vehicles?.brand} ${td.vehicles?.model}`,
          metadata: { bookingId, testDriveId: td.id, amount, paymentMethod: bookingPaymentMethod },
        });
      }

      toast({ title: 'Booking confirmed!', description: `₹${amount.toLocaleString()} booking created. Email sent to customer.` });
    } catch (err: any) {
      toast({ title: 'Booking failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBookingCreating(false);
    }
  };

  const assignedLogs = testDrives
    .flatMap(td => {
      const logs: Array<{ type: 'security' | 'status'; at: string; message: string; driveId: string }> = [];
      const securityMeta = securityEventsByDrive[td.id] || {};

      if (td.security_checked_in_at) {
        logs.push({
          type: 'security',
          at: td.security_checked_in_at,
          message: `${td.customers?.full_name} checked in at security${securityMeta.checkInBy ? ` by ${securityMeta.checkInBy}` : ''}`,
          driveId: td.id,
        });
      }

      if (td.security_checked_out_at) {
        logs.push({
          type: 'security',
          at: td.security_checked_out_at,
          message: `${td.customers?.full_name} checked out at security${securityMeta.completedBy ? ` by ${securityMeta.completedBy}` : securityMeta.checkOutBy ? ` by ${securityMeta.checkOutBy}` : ''}`,
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

      if (td.status === 'key_handover_to_sales') {
        logs.push({
          type: 'status',
          at: td.security_checked_out_at || td.updated_at || td.created_at,
          message: `${td.customers?.full_name} key handed over to sales`,
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
    in_progress: 'bg-accent text-accent-foreground',
    key_handover_to_sales: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const filteredDrives = testDrives.filter((drive) => {
    if (statusFilter === 'completed') return drive.status === 'completed';
    if (statusFilter === 'active') return drive.status !== 'completed' && drive.status !== 'cancelled';
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Header row: title + filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground tracking-tight">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profile?.full_name ? `Welcome, ${profile.full_name} · ` : ''}Your assigned test drives
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'completed') => setStatusFilter(v)}>
            <SelectTrigger className="w-[170px] sm:w-[200px] h-9 text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="active">Active Records</SelectItem>
              <SelectItem value="completed">Completed Records</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

   

      {/* ── Activity Insights ── */}
      <ActivityInsightsMini />

      <Card className="shadow-card border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Sales Process Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs sm:text-sm">
            <div className="rounded-lg bg-background border border-primary/10 p-2.5 flex gap-2 items-start">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">1</span>
              <span>Upload / confirm customer license.</span>
            </div>
            <div className="rounded-lg bg-background border border-primary/10 p-2.5 flex gap-2 items-start">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">2</span>
              <span>Assign vehicle (key handover).</span>
            </div>
            <div className="rounded-lg bg-background border border-primary/10 p-2.5 flex gap-2 items-start">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">3</span>
              <span>Track security start + active drive.</span>
            </div>
            <div className="rounded-lg bg-background border border-primary/10 p-2.5 flex gap-2 items-start">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">4</span>
              <span>Complete follow-up after return alert.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-info/20">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm sm:text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-info" /> Security Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {securityContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active security contacts found for this location.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {securityContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-info/20 bg-info/5 p-2.5 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{contact.full_name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone || 'Phone not available'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <Card className="shadow-card border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-destructive" /> My Opportunities
              {salesOpportunities.length > 0 && (
                <Badge className="ml-1 bg-destructive/10 text-destructive text-xs font-normal">{salesOpportunities.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 max-h-72 overflow-y-auto">
            {salesOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No opportunities created yet.</p>
            ) : salesOpportunities.map((opportunity) => (
              <div key={`opp-${opportunity.id}-${opportunity.latest_test_drive_id}`} className="rounded-md border border-border p-2.5 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground truncate">{opportunity.customers?.full_name || 'Customer'}</p>
                  <Badge className={opportunity.temperature === 'hot' ? 'bg-destructive/10 text-destructive text-xs' : 'bg-muted text-muted-foreground text-xs'}>
                    {String(opportunity.temperature || 'cold').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Test Drive: <span className="text-foreground font-medium">#{opportunity.latest_test_drive_id?.slice(0, 8)}</span></p>
                  <p>Vehicle: <span className="text-foreground font-medium">{opportunity.test_drives?.vehicles?.brand} {opportunity.test_drives?.vehicles?.model}</span></p>
                  <p>Email: <span className="text-foreground font-medium truncate">{opportunity.customers?.email || 'N/A'}</span></p>
                  <p>Phone: <span className="text-foreground font-medium">{opportunity.customers?.phone || 'N/A'}</span></p>
                  <p>Stage: <span className="text-foreground font-medium">{formatStatusLabel(opportunity.stage || 'new')}</span></p>
                </div>
                {opportunity.notes && (
                  <div className="rounded-md bg-muted/40 p-1.5 text-xs max-h-20 overflow-y-auto">
                    <p className="text-muted-foreground font-medium mb-1">Notes:</p>
                    <p className="text-foreground whitespace-pre-wrap text-[11px]">{opportunity.notes}</p>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={() => {
                    setOppNotesDialog({ open: true, opportunityId: opportunity.id });
                    setOppNoteText('');
                    setOppFollowUpDueAt('');
                  }}
                >
                  + Add Follow-up Note
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm sm:text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Open Follow-up Tasks
              {salesTasks.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary text-xs font-normal">{salesTasks.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 max-h-72 overflow-y-auto">
            {salesTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks.</p>
            ) : salesTasks.map((task) => (
              <div key={`task-${task.id}-${task.test_drive_id}`} className="rounded-md border border-border p-2.5 text-sm space-y-2">
                <p className="font-medium text-foreground truncate text-xs">{task.title}</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Test Drive: <span className="text-foreground font-medium">#{task.test_drive_id?.slice(0, 8)}</span></p>
                  <p>Customer: <span className="text-foreground font-medium truncate">{task.customers?.full_name || 'Customer'}</span></p>
                  <p>Email: <span className="text-foreground font-medium truncate">{task.customers?.email || 'N/A'}</span></p>
                  <p>Phone: <span className="text-foreground font-medium">{task.customers?.phone || 'N/A'}</span></p>
                  <p>Due: <span className="text-foreground font-medium">{task.due_at ? new Date(task.due_at).toLocaleString() : 'Not set'}</span></p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={() => {
                    setTaskNotesDialog({ open: true, taskId: task.id });
                    setTaskNoteText('');
                  }}
                >
                    + Add Follow-up Note (Coming Soon)
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="font-heading text-base sm:text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Assigned Test Drives
            <Badge variant="secondary" className="ml-1 text-xs font-normal">{filteredDrives.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 sm:gap-3">
            {filteredDrives.slice(0, 5).map(td => (
              <div
                key={td.id}
                className="p-3 rounded-lg border border-border bg-card/50 space-y-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setDetailSheetDrive(td)}
              >
                {/* ── Top row: status + customer ── */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{td.customers?.full_name}</p>
                    {td.customers?.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{td.customers.phone}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColor[td.status] || ''}`}>
                    {formatStatusLabel(td.status)}
                  </Badge>
                </div>

                {/* ── Vehicle + Date ── */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Car className="h-3 w-3" />{td.vehicles?.brand} {td.vehicles?.model}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{td.scheduled_date} {(td.scheduled_time || '').substring(0, 5)}</span>
                  {td.key_handed_at && td.status !== 'in_progress' && td.status !== 'completed' && (
                    <Badge className="text-[10px] bg-info/10 text-info border-info/20">Vehicle Assigned</Badge>
                  )}
                </div>

                {/* ── Licence section (original) ── */}
                <div onClick={e => e.stopPropagation()}>
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
                          <Badge variant="outline" className="text-warning text-xs">Pending Verification</Badge>
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
                </div>

                {/* ── Action buttons ── */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border" onClick={e => e.stopPropagation()}>
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
                  {(td.status === 'show' || td.status === 'scheduled') && !td.key_handed_at && td?.customers?.driving_license_verified && (
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => handleGiveKeyAndStart(td.id)}>
                      <Key className="h-3.5 w-3.5 mr-1" /> Assign Key
                    </Button>
                  )}
                  {td.status === 'key_handover_to_sales' && (
                    <>
                      <Badge className="bg-warning/10 text-warning text-xs"><Key className="h-3 w-3 mr-1" /> Key Handover Pending</Badge>
                      <Button
                        size="sm"
                        className="bg-success text-success-foreground hover:bg-success/90 text-xs"
                        onClick={async () => {
                          setCompletionLeadDialogDrive(td);
                          setLeadTemperature('cold');
                          setFollowUpTaskTitle('');
                          setFollowUpTaskDueAt('');
                          setSelectedQuestions([]);
                          setHandoverNotes('');
                          if (td.location_id) {
                            try {
                              const locationRow = await apiGet<any>(`/api/locations/${encodeURIComponent(td.location_id)}`);
                              const meta = locationRow?.metadata || {};
                              setPresetHandoverQuestions(Array.isArray(meta.handover_questions) ? meta.handover_questions : []);
                            } catch { setPresetHandoverQuestions([]); }
                          } else { setPresetHandoverQuestions([]); }
                        }}
                      >
                        <FileCheck className="h-3.5 w-3.5 mr-1" /> Key Handover To Sales
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
            </div>
            {filteredDrives.length > 5 && (
              <div className="flex justify-center pt-3">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/test-drives')}>
                  View All {filteredDrives.length} Test Drives →
                </Button>
              </div>
            )}
            {filteredDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No Test Drives Found For The Selected Filter.</p>
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
            <p className="text-sm text-muted-foreground py-4">No Logs Found For Your Assigned Test Drives.</p>
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

      {/* Test Drive Detail Sheet */}
      <TestDriveDetailSheet
        testDrive={detailSheetDrive}
        open={!!detailSheetDrive}
        onClose={() => setDetailSheetDrive(null)}
        securityEvents={detailSheetDrive ? securityEventsByDrive[detailSheetDrive.id] : undefined}
      />

      {/* Opportunity Notes Dialog */}
      <Dialog
        open={oppNotesDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setOppNotesDialog({ open: false, opportunityId: null });
            setOppFollowUpDueAt('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Follow-up Note to Opportunity</DialogTitle>
            <DialogDescription>Track your progress and next steps for this customer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={oppNoteText}
                onChange={(e) => setOppNoteText(e.target.value)}
                placeholder="Add your follow-up comment, observations, or next steps..."
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Next Follow-up Date & Time</Label>
              <Input
                type="datetime-local"
                value={oppFollowUpDueAt}
                onChange={(e) => setOppFollowUpDueAt(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveOppNote} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!oppNoteText.trim()}>
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Notes Dialog */}
      <Dialog open={taskNotesDialog.open} onOpenChange={(open) => !open && setTaskNotesDialog({ open: false, taskId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Follow-up Note to Task</DialogTitle>
            <DialogDescription>Track task progress and important updates</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={taskNoteText}
                onChange={(e) => setTaskNoteText(e.target.value)}
                placeholder="Add task update or follow-up comment..."
                className="min-h-24"
              />
            </div>
            <Button onClick={handleSaveTaskNote} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!taskNoteText.trim()}>
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Input type="date" value={newDate} min={new Date().toISOString().split('T')[0]} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>New Time</Label>
              <Input type="time" value={newTime} min={newDate === new Date().toISOString().split('T')[0] ? `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}` : undefined} onChange={e => setNewTime(e.target.value)} />
            </div>
            <Button onClick={handleReschedule} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!newDate || !newTime}>
              Confirm Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completionLeadDialogDrive} onOpenChange={(open) => { if (!open) { setCompletionLeadDialogDrive(null); setCompletionStep(1); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="font-heading text-base">Close Test Drive As Opportunity</DialogTitle>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">Step {completionStep} of 2</span>
            </div>
            <DialogDescription className="text-xs">
              {completionLeadDialogDrive?.customers?.full_name} • {completionLeadDialogDrive?.vehicles?.brand} {completionLeadDialogDrive?.vehicles?.model}
            </DialogDescription>
            {/* Step progress bar */}
            <div className="flex gap-1.5 mt-2">
              <div className={`h-1 flex-1 rounded-full transition-colors ${completionStep >= 1 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`h-1 flex-1 rounded-full transition-colors ${completionStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          </DialogHeader>

          {/* ── Step 1: Drive Feedback ── */}
          {completionStep === 1 && (
            <div className="space-y-4 py-1">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Lead Temperature</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLeadTemperature('hot')}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 px-3 transition-colors ${
                      leadTemperature === 'hot'
                        ? 'border-warning bg-warning/10 text-warning'
                        : 'border-border bg-background text-muted-foreground hover:border-warning/40'
                    }`}
                  >
                    <span className="text-2xl">🔥</span>
                    <span className="text-sm font-semibold">Hot Lead</span>
                    <span className="text-[11px] text-center leading-tight opacity-80">Customer wants to buy now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadTemperature('cold')}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 px-3 transition-colors ${
                      leadTemperature === 'cold'
                        ? 'border-info bg-info/10 text-info'
                        : 'border-border bg-background text-muted-foreground hover:border-info/40'
                    }`}
                  >
                    <span className="text-2xl">❄️</span>
                    <span className="text-sm font-semibold">Cold Lead</span>
                    <span className="text-[11px] text-center leading-tight opacity-80">Follow up later</span>
                  </button>
                </div>
              </div>

              {presetHandoverQuestions.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <CheckSquare className="h-4 w-4 text-primary" /> Questions Covered During Drive
                  </Label>
                  <p className="text-xs text-muted-foreground">Tick all topics that were covered (mandatory checklist).</p>
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                    {presetHandoverQuestions.map((q) => (
                      <div key={q} className="flex items-center gap-2">
                        <Checkbox
                          id={`hq-${q}`}
                          checked={selectedQuestions.includes(q)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedQuestions(prev => [...prev, q]);
                            else setSelectedQuestions(prev => prev.filter(x => x !== q));
                          }}
                        />
                        <label htmlFor={`hq-${q}`} className="text-sm cursor-pointer select-none">{q}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Handover Notes / Observations</Label>
                <Textarea
                  placeholder="Customer questions, concerns, observations during the test drive…"
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => setCompletionStep(2)}
              >
                Next — Follow-up & Actions →
              </Button>
            </div>
          )}

          {/* ── Step 2: Follow-up & Close ── */}
          {completionStep === 2 && (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Follow-up Task Title</Label>
                <Input
                  value={followUpTaskTitle}
                  onChange={(event) => setFollowUpTaskTitle(event.target.value)}
                  placeholder={leadTemperature === 'hot'
                    ? 'Call customer for booking amount and finance options'
                    : 'Follow up after test drive and capture objections'}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Task Due At</Label>
                <Input type="datetime-local"  min={todayStr}
                      max={maxDateStr} 
                      value={followUpTaskDueAt} onChange={(event) => setFollowUpTaskDueAt(event.target.value)} />
              </div>

              {/* HOT LEAD — Booking / Payment section */}
              {leadTemperature === 'hot' && (
                <div className="space-y-3 rounded-xl border-2 border-warning/40 bg-warning/5 p-4">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold text-warning-foreground">
                    <BookOpen className="h-4 w-4 text-warning" /> Book Car — Payment Details
                  </Label>
                  <p className="text-xs text-muted-foreground">Collect booking amount now or send a payment link.</p>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Payment Method</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingPaymentMethod('cash')}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition-colors ${
                          bookingPaymentMethod === 'cash'
                            ? 'border-success bg-success/10 text-success'
                            : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <Banknote className="h-4 w-4" /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingPaymentMethod('payment_link')}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition-colors ${
                          bookingPaymentMethod === 'payment_link'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <Link2 className="h-4 w-4" /> Payment Link
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Booking Amount (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 50000"
                      value={bookingAmount}
                      onChange={e => setBookingAmount(e.target.value)}
                    />
                  </div>

                  {bookingPaymentMethod === 'payment_link' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Payment Link URL</Label>
                      <Input
                        type="url"
                        placeholder="https://razorpay.com/l/your-link"
                        value={bookingPaymentLink}
                        onChange={e => setBookingPaymentLink(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Booking Notes</Label>
                    <Input
                      placeholder="e.g. Colour preference: White, Finance pre-approved"
                      value={bookingNotes}
                      onChange={e => setBookingNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setCompletionStep(1)}>
                  ← Back
                </Button>
                <Button onClick={handleCompleteWithLead} className="flex-1 bg-success text-success-foreground hover:bg-success/90">
                  <FileCheck className="h-4 w-4 mr-1.5" />
                  {leadTemperature === 'hot' ? 'Complete + Book' : 'Complete + Create Task'}
                </Button>
              </div>
            </div>
          )}
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

      <Dialog open={!!inspectionDocView} onOpenChange={() => setInspectionDocView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inspection Media</DialogTitle>
            <DialogDescription>{inspectionDocView?.filename}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[220px]">
            {inspectionDocView?.url ? (
              inspectionDocView.filename.toLowerCase().match(/\.(mp4|webm|mov|m4v|avi)$/) ? (
                <video controls className="max-w-full max-h-[420px] rounded-lg" src={inspectionDocView.url} />
              ) : (
                <img src={inspectionDocView.url} alt={inspectionDocView.filename} className="max-w-full max-h-[420px] rounded-lg object-contain" />
              )
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-muted text-foreground hover:bg-muted/80" onClick={() => setInspectionDocView(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesDashboard;
