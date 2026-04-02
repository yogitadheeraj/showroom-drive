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
import { APP_ROLE } from '@/constants/roles';

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
  const [leadTemperature, setLeadTemperature] = useState<LeadTemperature>('cold');
  const [followUpTaskTitle, setFollowUpTaskTitle] = useState('');
  const [followUpTaskDueAt, setFollowUpTaskDueAt] = useState('');
  const [salesOpportunities, setSalesOpportunities] = useState<any[]>([]);
  const [salesTasks, setSalesTasks] = useState<any[]>([]);
  const { toast } = useToast();

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

          if (after?.status !== 'key_handover_to_sales' || before?.status === 'key_handover_to_sales') return;

          const { data: drive } = await supabase
            .from('test_drives')
            .select('id, customers(full_name)')
            .eq('id', after.id)
            .maybeSingle();

          const customerName = drive?.customers?.full_name || 'Customer';

          toast({
            title: 'Key handover to sales',
            description: `Please take follow up from Mr. ${customerName} and close the drive.`,
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

    const drives = data || [];
    setTestDrives(drives);

    const locationIds = Array.from(new Set(drives.map((drive: any) => drive.location_id).filter(Boolean)));
    if (locationIds.length > 0) {
      const { data: securityProfiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone, location_id, is_active')
        .in('location_id', locationIds)
        .eq('is_active', true)
        .order('full_name');

      const profiles = securityProfiles || [];
      const userIds = profiles.map((profileRow: any) => profileRow.user_id).filter(Boolean);

      if (userIds.length > 0) {
        const { data: securityRoles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', APP_ROLE.SECURITY)
          .in('user_id', userIds);

        const securityUserIds = new Set((securityRoles || []).map((row: any) => row.user_id));
        const uniqueContacts = profiles
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
    } else {
      setSecurityContacts([]);
    }

    if (drives.length > 0) {
      await Promise.all(
        drives.map(async (drive) => {
          const { data: docs } = await supabase.storage.from('documents').list(`test-drives/${drive.id}`, { limit: 200 });
          setInspectionDocsByDrive((prev) => ({ ...prev, [drive.id]: docs || [] }));
        })
      );
    } else {
      setInspectionDocsByDrive({});
    }

    if (!drives.length) {
      setSecurityEventsByDrive({});
      return;
    }

    const driveIds = new Set(drives.map((d) => d.id));
    const { data: securityEvents } = await supabase
      .from('staff_activity_events')
      .select('event_type, event_label, happened_at, metadata, profiles:profile_id(full_name)')
      .eq('role', 'security')
      .in('event_type', [
        'test_drive_check_in',
        'test_drive_check_out',
        'test_drive_completed',
        'vehicle_inspection_pre',
        'vehicle_inspection_post',
        'license_verified',
      ])
      .order('happened_at', { ascending: false })
      .limit(1000);

    const perDrive: Record<string, any> = {};
    for (const event of securityEvents || []) {
      const testDriveId = (event as any)?.metadata?.testDriveId;
      if (!testDriveId || !driveIds.has(testDriveId)) continue;

      const fullName = (event as any)?.profiles?.full_name || 'Security';
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
  };

  const fetchLeadWorkspace = async () => {
    if (!profile?.id) return;

    const [opportunityRes, taskRes] = await Promise.all([
      (supabase as any)
        .from('sales_opportunities')
        .select('id, customer_id, latest_test_drive_id, temperature, stage, updated_at, customers(id, full_name, phone, email), test_drives!sales_opportunities_latest_test_drive_id_fkey(id, scheduled_date, vehicles(brand, model))')
        .eq('owner_profile_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(50),
      (supabase as any)
        .from('sales_tasks')
        .select('id, title, due_at, status, priority, test_drive_id, created_at, customers(id, full_name, phone, email)')
        .eq('assigned_to_profile_id', profile.id)
        .eq('status', 'open')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(50),
    ]);

    if (opportunityRes.error) {
      setSalesOpportunities([]);
    } else {
      // Deduplicate opportunities by customer_id + latest_test_drive_id to prevent duplicates
      const seenCombo = new Set<string>();
      const uniqueOpportunities = (opportunityRes.data || []).filter((opp: any) => {
        const key = `${opp.customer_id}-${opp.latest_test_drive_id}`;
        if (seenCombo.has(key)) return false;
        seenCombo.add(key);
        return true;
      }).slice(0, 12);
      setSalesOpportunities(uniqueOpportunities);
    }

    if (taskRes.error) {
      setSalesTasks([]);
    } else {
      // Deduplicate tasks by test_drive_id + title to prevent duplicates
      const seenCombo = new Set<string>();
      const uniqueTasks = (taskRes.data || []).filter((task: any) => {
        const key = `${task.test_drive_id}-${task.title}`;
        if (seenCombo.has(key)) return false;
        seenCombo.add(key);
        return true;
      }).slice(0, 12);
      setSalesTasks(uniqueTasks);
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

    const { data: existingOpportunity } = await (supabase as any)
      .from('sales_opportunities')
      .select('id, notes')
      .eq('customer_id', td.customer_id)
      .eq('owner_profile_id', profile.id)
      .eq('location_id', td.location_id)
      .not('stage', 'in', '(won,lost)')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let opportunityId: string;
    if (existingOpportunity?.id) {
      const mergedNotes = `${existingOpportunity.notes || ''}\n${statusNote}`.trim();
      const { error: updateError } = await (supabase as any)
        .from('sales_opportunities')
        .update({
          latest_test_drive_id: td.id,
          temperature: selectedTemperature,
          stage,
          notes: mergedNotes,
          updated_at: completedAt,
        })
        .eq('id', existingOpportunity.id);

      if (updateError) throw updateError;
      opportunityId = existingOpportunity.id;
    } else {
      const { data: insertedOpportunity, error: insertError } = await (supabase as any)
        .from('sales_opportunities')
        .insert({
          customer_id: td.customer_id,
          latest_test_drive_id: td.id,
          location_id: td.location_id,
          owner_profile_id: profile.id,
          temperature: selectedTemperature,
          stage,
          notes: statusNote,
        })
        .select('id')
        .single();

      if (insertError || !insertedOpportunity?.id) throw insertError || new Error('Unable to create opportunity');
      opportunityId = insertedOpportunity.id;
    }

    const finalTaskTitle = (taskTitle || '').trim() || (selectedTemperature === 'hot'
      ? 'Call customer for booking amount and finance options'
      : 'Follow up after test drive and capture objections');

    const dueAt = taskDueAt
      ? new Date(taskDueAt).toISOString()
      : new Date(Date.now() + (selectedTemperature === 'hot' ? 24 : 72) * 60 * 60 * 1000).toISOString();

    // Check if task already exists for this test drive to prevent duplicates
    const { data: existingTask } = await (supabase as any)
      .from('sales_tasks')
      .select('id')
      .eq('test_drive_id', td.id)
      .eq('assigned_to_profile_id', profile.id)
      .eq('status', 'open')
      .maybeSingle();

    // Only insert task if it doesn't already exist
    if (!existingTask?.id) {
      const { error: taskError } = await (supabase as any)
        .from('sales_tasks')
        .insert({
          opportunity_id: opportunityId,
          test_drive_id: td.id,
          customer_id: td.customer_id,
          assigned_to_profile_id: profile.id,
          title: finalTaskTitle,
          due_at: dueAt,
          status: 'open',
          priority: selectedTemperature === 'hot' ? 'high' : 'medium',
        });

      if (taskError) throw taskError;
    }
  };

  const getInspectionMedia = (testDriveId: string, type: 'pre' | 'post') => {
    return (inspectionDocsByDrive[testDriveId] || []).filter((doc: any) => doc.name.startsWith(`inspection-${type}-`));
  };

  const viewInspectionMedia = async (testDriveId: string, filename: string) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(`test-drives/${testDriveId}/${filename}`, 300);
    if (error || !data?.signedUrl) {
      toast({ title: 'Failed to open media', description: error?.message || 'Unable to generate preview URL', variant: 'destructive' });
      return;
    }
    setInspectionDocView({ url: data.signedUrl, filename });
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
    } as any).eq('id', id);
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
    options?: { leadTemperature?: LeadTemperature; taskTitle?: string; taskDueAt?: string }
  ) => {
    const id = td.id;
    const completedAt = new Date().toISOString();
    await supabase.from('test_drives').update({
      status: 'completed' as any,
      completed_at: completedAt,
    }).eq('id', id);

    if (td?.customers?.email) {
      const customerName = td.customers.full_name || 'Customer';
      const message = buildTraceabilityMessage(td, completedAt);

      const { error: emailError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'sales-follow-up',
          recipientEmail: td.customers.email,
          idempotencyKey: `test-drive-completed-${id}`,
          templateData: {
            customerName,
            message,
          },
        },
      });

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

  const handleCompleteWithLead = async () => {
    if (!completionLeadDialogDrive) return;

    await handleComplete(completionLeadDialogDrive, {
      leadTemperature,
      taskTitle: followUpTaskTitle,
      taskDueAt: followUpTaskDueAt || undefined,
    });

    setCompletionLeadDialogDrive(null);
    setLeadTemperature('cold');
    setFollowUpTaskTitle('');
    setFollowUpTaskDueAt('');
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
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Sales Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your assigned test drives</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Assigned', value: testDrives.length, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'In Progress', value: testDrives.filter(t => t.status === 'in_progress').length, icon: Key, color: 'text-info', bg: 'bg-green/10' },
          { label: 'Completed', value: testDrives.filter(t => t.status === 'completed').length, icon: FileCheck, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Pending License', value: testDrives.filter(t => !t.customers?.driving_license_url).length, icon: Upload, color: 'text-warning', bg: 'bg-warning/10' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-card min-w-0">
              <CardContent className="p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4">
                <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-sm text-muted-foreground leading-tight break-words">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm sm:text-base">Sales SOP</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs sm:text-sm">
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">1.</span> Upload / confirm customer license.</div>
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">2.</span> Assign vehicle (key handover).</div>
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">3.</span> Track security start + active drive.</div>
            <div className="rounded-md bg-muted/40 p-2"><span className="font-medium">4.</span> Complete follow-up after return alert.</div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-info/20">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm sm:text-base">Available Security Contacts</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {securityContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Active Security Contacts Found For This Location.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {securityContacts.map((contact) => (
                <div key={contact.id} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="font-medium text-foreground">{contact.full_name}</p>
                  <p className="text-xs text-muted-foreground">{contact.phone || 'Phone Not Available'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <Card className="shadow-card border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm sm:text-base">My Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 max-h-72 overflow-y-auto">
            {salesOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No opportunities created yet.</p>
            ) : salesOpportunities.map((opportunity) => (
              <div key={`opp-${opportunity.id}-${opportunity.latest_test_drive_id}`} className="rounded-md border border-border p-2.5 text-sm space-y-1.5">
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
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm sm:text-base">Open Follow-up Tasks</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 max-h-72 overflow-y-auto">
            {salesTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks.</p>
            ) : salesTasks.map((task) => (
              <div key={`task-${task.id}-${task.test_drive_id}`} className="rounded-md border border-border p-2.5 text-sm space-y-1.5">
                <p className="font-medium text-foreground truncate text-xs">{task.title}</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Test Drive: <span className="text-foreground font-medium">#{task.test_drive_id?.slice(0, 8)}</span></p>
                  <p>Customer: <span className="text-foreground font-medium truncate">{task.customers?.full_name || 'Customer'}</span></p>
                  <p>Email: <span className="text-foreground font-medium truncate">{task.customers?.email || 'N/A'}</span></p>
                  <p>Phone: <span className="text-foreground font-medium">{task.customers?.phone || 'N/A'}</span></p>
                  <p>Due: <span className="text-foreground font-medium">{task.due_at ? new Date(task.due_at).toLocaleString() : 'Not set'}</span></p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-heading text-base sm:text-lg">Assigned Test Drives</CardTitle>
            <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'completed') => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[200px]">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 sm:gap-3">
            {filteredDrives.map(td => (
              <div key={td.id} className="p-2.5 sm:p-3 rounded-lg border border-border space-y-2.5 bg-card/50">
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
                      {formatStatusLabel(td.status)}
                    </Badge>
                    {td.key_handed_at && td.status !== 'in_progress' && td.status !== 'completed' && (
                      <Badge className="text-xs bg-info/10 text-info">Vehicle Assigned</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Car className="h-3 w-3" />{td.vehicles?.brand} {td.vehicles?.model}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{td.scheduled_date} {td.scheduled_time}</span>
                </div>

                <div className="rounded-md border border-border/70 p-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Vehicle Assigned</span>
                    <span className="text-foreground">{td.key_handed_at ? `By ${profile?.full_name || 'Sales'} • ${new Date(td.key_handed_at).toLocaleString()}` : 'Pending Confirmation'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Security Start</span>
                    <span className="text-foreground">{td.security_checked_in_at ? `${securityEventsByDrive[td.id]?.checkInBy || 'Security'} • ${new Date(td.security_checked_in_at).toLocaleString()}` : 'Pending Confirmation'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Return Complete</span>
                    <span className="text-foreground">{td.security_checked_out_at ? `${securityEventsByDrive[td.id]?.completedBy || securityEventsByDrive[td.id]?.checkOutBy || 'Security'} • ${new Date(td.security_checked_out_at).toLocaleString()}` : 'Pending Confirmation'}</span>
                  </div>
                </div>

                {td.status === 'completed' && (
                  <div className="rounded-md border border-success/30 bg-success/5 p-2.5 space-y-2 text-xs">
                    <p className="font-semibold text-foreground">Completed Drive Details</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Pre KM:</span>{' '}
                        <span className="font-medium">{(td as any).pre_drive_km ?? 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pre Fuel:</span>{' '}
                        <span className="font-medium">{(td as any).pre_drive_fuel_level || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Post KM:</span>{' '}
                        <span className="font-medium">{(td as any).post_drive_km ?? 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Post Fuel:</span>{' '}
                        <span className="font-medium">{(td as any).post_drive_fuel_level || 'N/A'}</span>
                      </div>
                    </div>

                    {(td as any).pre_drive_km && (td as any).post_drive_km && (
                      <div>
                        <span className="text-muted-foreground">Distance:</span>{' '}
                        <span className="font-medium">{((td as any).post_drive_km - (td as any).pre_drive_km).toFixed(1)} km</span>
                      </div>
                    )}

                    <div className="pt-1 border-t border-border/60 space-y-1">
                      <p className="text-muted-foreground font-medium">Security Logs</p>
                      {(securityEventsByDrive[td.id]?.logs?.length ?? 0) > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {securityEventsByDrive[td.id].logs.map((log: any, index: number) => (
                            <div key={`${log.eventType}-${log.happenedAt}-${index}`} className="rounded border border-border/60 bg-background/70 p-1.5">
                              <p className="text-foreground leading-tight">{log.label}</p>
                              <p className="text-muted-foreground">{log.by} • {new Date(log.happenedAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No security logs available.</p>
                      )}
                    </div>
                  </div>
                )}

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
                  {(td.status === 'show' || td.status === 'scheduled') && !td.key_handed_at && td?.customers?.driving_license_verified && (
                    <Button size="sm" className={`bg-primary text-primary-foreground hover:bg-primary/90 text-xs`} onClick={() => handleGiveKeyAndStart(td.id)}>
                      <Key className="h-3.5 w-3.5 mr-1" /> Assign key
                    </Button>
                  )}
                  {td.status === 'key_handover_to_sales' && (
                    <>
                      <Badge className="bg-warning/10 text-warning text-xs"><Key className="h-3 w-3 mr-1" /> Key Handover Pending</Badge>
                      <Button
                        size="sm"
                        className="bg-success text-success-foreground hover:bg-success/90 text-xs"
                        onClick={() => {
                          setCompletionLeadDialogDrive(td);
                          setLeadTemperature('cold');
                          setFollowUpTaskTitle('');
                          setFollowUpTaskDueAt('');
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

      <Dialog open={!!completionLeadDialogDrive} onOpenChange={(open) => !open && setCompletionLeadDialogDrive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Close Test Drive As Opportunity</DialogTitle>
            <DialogDescription>
              {completionLeadDialogDrive?.customers?.full_name} • {completionLeadDialogDrive?.vehicles?.brand} {completionLeadDialogDrive?.vehicles?.model}
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
                  <SelectItem value="hot">Hot Lead (customer wants to buy)</SelectItem>
                  <SelectItem value="cold">Cold Lead (follow up later)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Follow-up Task Title</Label>
              <Input
                value={followUpTaskTitle}
                onChange={(event) => setFollowUpTaskTitle(event.target.value)}
                placeholder={leadTemperature === 'hot'
                  ? 'Call customer for booking amount and finance options'
                  : 'Follow up after test drive and capture objections'}
              />
            </div>
            <div className="space-y-2">
              <Label>Task Due At</Label>
              <Input type="datetime-local" value={followUpTaskDueAt} onChange={(event) => setFollowUpTaskDueAt(event.target.value)} />
            </div>
            <Button onClick={handleCompleteWithLead} className="w-full bg-success text-success-foreground hover:bg-success/90">
              Complete Drive + Create Opportunity + Task
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
                  {getInspectionMedia(inspectionViewDrive.id, 'pre').length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground">Media</p>
                      <div className="flex flex-wrap gap-1">
                        {getInspectionMedia(inspectionViewDrive.id, 'pre').map((doc: any, idx: number) => (
                          <Button key={`${doc.name}-${idx}`} size="sm" variant="outline" className="h-7 text-xs" onClick={() => void viewInspectionMedia(inspectionViewDrive.id, doc.name)}>
                            <Eye className="h-3 w-3 mr-1" /> {doc.name.split('/').pop()?.slice(0, 18)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
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
                  {getInspectionMedia(inspectionViewDrive.id, 'post').length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground">Media</p>
                      <div className="flex flex-wrap gap-1">
                        {getInspectionMedia(inspectionViewDrive.id, 'post').map((doc: any, idx: number) => (
                          <Button key={`${doc.name}-${idx}`} size="sm" variant="outline" className="h-7 text-xs" onClick={() => void viewInspectionMedia(inspectionViewDrive.id, doc.name)}>
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
