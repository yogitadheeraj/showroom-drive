import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiGet, apiPost, apiPatch, apiDbQuery } from '@/lib/apiClient';
import { logStaffActivity } from '@/lib/activityLogger';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { CalendarX, RefreshCw, Car, Clock, MapPin, User, Users, Phone, Route, Ban, TrendingUp, Key, FileCheck, CheckCircle2, CheckCircle, XCircle, PlayCircle, MoreHorizontal, PlusCircle, CalendarClock, Shield, LayoutGrid, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import { TestDriveJourneyDialog } from '@/components/TestDriveJourneyDialog';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';
import WalkinDialog from '@/components/WalkinDialog';

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
  const [groupBySales, setGroupBySales] = useState(false);
  const [rebookDrive, setRebookDrive] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarSelectedDrive, setCalendarSelectedDrive] = useState<any | null>(null);
  const [calendarViewType, setCalendarViewType] = useState<'week' | 'month' | 'year'>('week');
  const [calendarInsight, setCalendarInsight] = useState<{ type: 'day' | 'week' | 'month' | 'year'; date: Date } | null>(null);

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
      // Sales only see their own assigned drives
      params.set('sales_person_id', profile.id);
    }

    if (statusFilter !== 'all') params.set('status', statusFilter);

    // Location scoping per role
    if (role === APP_ROLE.GRO || role === APP_ROLE.SECURITY || role === APP_ROLE.SALES_ADMIN) {
      // Strictly scoped to their own location
      if (profile?.location_id) params.set('location_id', profile.location_id);
    } else if (role !== APP_ROLE.SUPERADMIN && dealerLocationIds && dealerLocationIds.length > 0) {
      params.set('location_ids', dealerLocationIds.join(','));
    }

    const drives = await apiGet<any[]>(`/api/test-drives?${params}`);
    setTestDrives(drives || []);
  };

  // Group drives by assigned sales person (for Branch Admin)
  const displayGroups = useMemo(() => {
    if (!groupBySales || role !== APP_ROLE.SALES_ADMIN) {
      return [{ label: '', drives: testDrives }];
    }
    const map = new Map<string, any[]>();
    for (const td of testDrives) {
      const key = td.assigned_sales_person?.full_name ?? 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(td);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
      })
      .map(([label, drives]) => ({ label, drives }));
  }, [testDrives, groupBySales, role]);

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newTime) return;
    const original = testDrives.find((t) => t.id === rescheduleId);
    if (!original) return;

    await apiPatch(`/api/test-drives/${encodeURIComponent(rescheduleId)}`, {
      scheduled_date: newDate,
      scheduled_time: `${newTime}:00`,
      status: 'rescheduled',
    });

    // Email is sent automatically by the backend afterStatusChange handler
    toast({ title: 'Test drive rescheduled' });
    if (profile?.user_id) {
      void logStaffActivity({
        userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
        eventType: 'test_drive_rescheduled',
        label: `Rescheduled test drive to ${newDate} ${newTime}`,
        route: '/test-drives',
        metadata: { testDriveId: rescheduleId, customerId: original?.customer_id, newDate, newTime, originalDate: original?.scheduled_date, originalTime: original?.scheduled_time, vehicleName: `${original?.vehicles?.brand ?? ''} ${original?.vehicles?.model ?? ''}`.trim() || null },
      });
    }
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

    // Email is sent automatically by the backend afterStatusChange handler
    toast({ title: 'Test drive cancelled' });
    if (profile?.user_id) {
      void logStaffActivity({
        userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
        eventType: 'test_drive_cancelled',
        label: `Cancelled test drive${cancelReason ? `: ${cancelReason}` : ''}`,
        route: '/test-drives',
        metadata: { testDriveId: cancelId, customerId: original?.customer_id, cancelReason: cancelReason || null, vehicleName: `${original?.vehicles?.brand ?? ''} ${original?.vehicles?.model ?? ''}`.trim() || null },
      });
    }
    setCancelId(null);
    setCancelReason('');
    fetchTestDrives();
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
  const handleCreateOpportunity = async () => {
    if (!leadDialogDrive?.customer_id || !profile?.id) return;

    try {
      const stage = leadTemperature === 'hot' ? 'qualified' : 'new';
      const statusNote = `[${new Date().toLocaleString()}] Lead marked ${leadTemperature.toUpperCase()} from Test Drives page.`;
      await apiPatch(`/api/test-drives/${encodeURIComponent(leadDialogDrive.id)}`, { key_handover_completed_at: new Date().toISOString(), status: 'completed' });
  
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
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'test_drive_opportunity_created',
          label: `Created ${leadTemperature.toUpperCase()} opportunity from test drive`,
          route: '/test-drives',
          metadata: { testDriveId: leadDialogDrive.id, customerId: leadDialogDrive.customer_id, opportunityId, temperature: leadTemperature, stage },
        });
      }
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
    if (profile?.user_id) {
      void logStaffActivity({
        userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
        eventType: 'test_drive_status_changed',
        label: `Changed test drive status to ${newStatus}`,
        route: '/test-drives',
        metadata: { testDriveId: id, newStatus },
      });
    }
    fetchTestDrives();
  };

  const handleAssignKey = async (id: string) => {
    setAssigningKey(id);
    try {
      await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { key_handed_at: new Date().toISOString(), status: 'in_progress' });
      toast({ title: 'Key assigned', description: 'Test drive is now in progress.' });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'test_drive_key_assigned',
          label: 'Assigned key and started test drive',
          route: '/test-drives',
          metadata: { testDriveId: id },
        });
      }
    } finally {
      setAssigningKey(null);
      fetchTestDrives();
    }
  };

  const handleSecurityCheckIn = async (id: string, locationId?: string) => {
    setSecurityActionId(id);
    try {
      // Determine which security person to assign
      let securityPersonId: string | null = null;
      if (role === APP_ROLE.SECURITY && profile?.id) {
        // The logged-in security person does it themselves
        securityPersonId = profile.id;
      } else if (locationId) {
        // Non-security role (admin etc.) — auto-pick available security person at location
        const securityProfiles = await apiGet<any[]>(`/api/profiles?role=security&location_id=${locationId}`);
        if (securityProfiles && securityProfiles.length > 0) {
          // Find the security person not currently handling an in-progress drive
          const inProgressIds = new Set(
            testDrives
              .filter(t => t.status === 'in_progress' && t.assigned_security_person_id)
              .map(t => t.assigned_security_person_id)
          );
          const available = securityProfiles.find(p => !inProgressIds.has(p.id));
          securityPersonId = available?.id ?? securityProfiles[0].id;
        }
      }

      await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, {
        security_checked_in_at: new Date().toISOString(),
        status: 'in_progress',
        ...(securityPersonId ? { assigned_security_person_id: securityPersonId } : {}),
      });
      toast({ title: 'Test drive started' });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'test_drive_check_in',
          label: 'Security checked in customer for test drive',
          route: '/test-drives',
          metadata: { testDriveId: id, assignedSecurityPersonId: securityPersonId },
        });
      }
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
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'test_drive_check_out',
          label: 'Security checked out vehicle — returned to sales',
          route: '/test-drives',
          metadata: { testDriveId: id },
        });
      }
    } finally {
      setSecurityActionId(null);
      fetchTestDrives();
    }
  };

  const handleKeyHandoverComplete = async (td: any) => {
    setLeadDialogDrive(td);
    setLeadTemperature('cold');
    setFollowUpTaskTitle('');
    setFollowUpTaskDueAt('');
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

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const calendarWeekStart = useMemo(() => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [calendarDate]);

  const calendarDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(calendarWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [calendarWeekStart]);

  // Month grid: 6 weeks starting from first Sunday on or before the 1st of the month
  const calendarMonthGrid = useMemo(() => {
    const y = calendarDate.getFullYear();
    const m = calendarDate.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [calendarDate]);

  const calendarHours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const statusCalColor: Record<string, string> = {
    scheduled: 'bg-blue-500 text-white',
    confirmed: 'bg-indigo-500 text-white',
    show: 'bg-emerald-500 text-white',
    no_show: 'bg-amber-500 text-white',
    in_progress: 'bg-orange-500 text-white',
    completed: 'bg-green-600 text-white',
    cancelled: 'bg-red-500 text-white',
    rescheduled: 'bg-slate-400 text-white',
  };

  const statusDotColor: Record<string, string> = {
    scheduled: 'bg-blue-500',
    confirmed: 'bg-indigo-500',
    show: 'bg-emerald-500',
    no_show: 'bg-amber-500',
    in_progress: 'bg-orange-500',
    completed: 'bg-green-600',
    cancelled: 'bg-red-500',
    rescheduled: 'bg-slate-400',
  };

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const drivesOnDay = (day: Date) => {
    const dayStr = fmtDate(day);
    return testDrives.filter((td) => td.scheduled_date === dayStr);
  };

  const driveAtHour = (day: Date, hour: number) =>
    drivesOnDay(day).filter((td) => parseInt((td.scheduled_time || '00:00').split(':')[0], 10) === hour);

  const drivesInMonth = (year: number, month: number) =>
    testDrives.filter((td) => {
      if (!td.scheduled_date) return false;
      const [y, m] = td.scheduled_date.split('-').map(Number);
      return y === year && m - 1 === month;
    });

  const drivesInYear = (year: number) =>
    testDrives.filter((td) => td.scheduled_date?.startsWith(String(year)));

  // Insight computation
  const insightDrives = useMemo(() => {
    if (!calendarInsight) return testDrives;
    const { type, date } = calendarInsight;
    if (type === 'day') return drivesOnDay(date);
    if (type === 'week') {
      const start = new Date(date);
      start.setDate(start.getDate() - start.getDay());
      const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
      return days.flatMap(drivesOnDay);
    }
    if (type === 'month') return drivesInMonth(date.getFullYear(), date.getMonth());
    if (type === 'year') return drivesInYear(date.getFullYear());
    return testDrives;
  }, [calendarInsight, testDrives]);

  const insightLabel = useMemo(() => {
    if (!calendarInsight) return 'All Drives';
    const { type, date } = calendarInsight;
    if (type === 'day') return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (type === 'week') {
      const start = new Date(date);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return `Week: ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (type === 'month') return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (type === 'year') return `Year ${date.getFullYear()}`;
    return '';
  }, [calendarInsight]);

  const insightStats = useMemo(() => {
    const total = insightDrives.length;
    const byStatus = insightDrives.reduce((acc: Record<string, number>, td) => {
      acc[td.status] = (acc[td.status] || 0) + 1;
      return acc;
    }, {});
    const completionRate = total > 0 ? Math.round(((byStatus.completed || 0) / total) * 100) : 0;
    const showRate = total > 0 ? Math.round((((byStatus.show || 0) + (byStatus.completed || 0) + (byStatus.in_progress || 0)) / total) * 100) : 0;
    return { total, byStatus, completionRate, showRate };
  }, [insightDrives]);

  const navigateCalendar = (dir: 1 | -1) => {
    const isAtCurrentYear = calendarViewType === 'year' && calendarDate.getFullYear() >= new Date().getFullYear();
    if (dir === 1 && isAtCurrentYear) return;
    const d = new Date(calendarDate);
    if (calendarViewType === 'week') d.setDate(d.getDate() + dir * 7);
    else if (calendarViewType === 'month') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setCalendarDate(d);
    setCalendarInsight(null);
  };


  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Test Drives
          </h1>
            <p className="text-sm text-muted-foreground">Manage all test drive appointments and journey completion quality</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                  viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setViewMode('calendar')}
              >
                <Calendar className="h-3.5 w-3.5" /> Calendar
              </button>
            </div>
            {role === APP_ROLE.SALES_ADMIN && (
              <Button
                size="sm"
                variant={groupBySales ? 'default' : 'outline'}
                className="text-xs gap-1.5 h-9"
                onClick={() => setGroupBySales((v) => !v)}
              >
                <Users className="h-3.5 w-3.5" />
                Group by Sales
              </Button>
            )}
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
        </div>

        {/* ── Calendar View ─────────────────────────────────────────────── */}
        {viewMode === 'calendar' && (
          <div className="flex gap-4 min-h-[600px]">
            {/* ── Left: Calendar ── */}
            <div className="flex-1 min-w-0 rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 gap-3 flex-wrap">
                {/* View type toggle */}
                <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs">
                  {(['week', 'month', 'year'] as const).map((vt) => (
                    <button
                      key={vt}
                      onClick={() => { setCalendarViewType(vt); setCalendarInsight(null); setCalendarSelectedDrive(null); }}
                      className={`px-3 py-1.5 capitalize transition-colors ${
                        calendarViewType === vt ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {vt}
                    </button>
                  ))}
                </div>

                {/* Period label + nav */}
                <div className="flex items-center gap-2">
                  <button onClick={() => navigateCalendar(-1)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold text-foreground min-w-[160px] text-center">
                    {calendarViewType === 'week' && `${calendarDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${calendarDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    {calendarViewType === 'month' && calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    {calendarViewType === 'year' && String(calendarDate.getFullYear())}
                  </span>
                  <button
                    onClick={() => navigateCalendar(1)}
                    disabled={calendarViewType === 'year' && calendarDate.getFullYear() >= new Date().getFullYear()}
                    className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                      calendarViewType === 'year' && calendarDate.getFullYear() >= new Date().getFullYear()
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => { setCalendarDate(new Date()); setCalendarInsight(null); }}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                >
                  Today
                </button>
              </div>

              {/* ── WEEK VIEW ── */}
              {calendarViewType === 'week' && (
                <>
                  <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                    <div className="border-r border-border" />
                    {calendarDays.map((day) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      const count = drivesOnDay(day).length;
                      const isSelected = calendarInsight?.type === 'day' && calendarInsight.date.toDateString() === day.toDateString();
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setCalendarInsight({ type: 'day', date: day })}
                          className={`py-2 px-1 text-center border-r border-border last:border-r-0 transition-colors hover:bg-primary/5 ${
                            isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''}`}
                        >
                          <div className={`text-[10px] uppercase tracking-wide font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                            {day.toLocaleDateString(undefined, { weekday: 'short' })}
                          </div>
                          <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</div>
                          {count > 0 && <div className="text-[9px] text-primary font-medium mt-0.5">{count}</div>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {calendarHours.map((hour) => (
                      <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border last:border-b-0 min-h-[60px]">
                        <div className="border-r border-border px-1 py-1 flex items-start justify-end">
                          <span className="text-[10px] text-muted-foreground">{hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}</span>
                        </div>
                        {calendarDays.map((day) => {
                          const drives = driveAtHour(day, hour);
                          const isToday = day.toDateString() === new Date().toDateString();
                          return (
                            <div key={day.toISOString()} className={`border-r border-border last:border-r-0 p-1 space-y-0.5 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                              {drives.map((td) => (
                                <button
                                  key={td.id}
                                  onClick={(e) => { e.stopPropagation(); setCalendarSelectedDrive(td); setCalendarInsight({ type: 'day', date: day }); }}
                                  className={`w-full text-left rounded px-1.5 py-1 text-[10px] font-medium leading-tight truncate transition-opacity hover:opacity-80 ${statusCalColor[td.status] ?? 'bg-slate-400 text-white'} ${calendarSelectedDrive?.id === td.id ? 'ring-2 ring-white ring-offset-1' : ''}`}
                                >
                                  <div className="font-semibold truncate">{td.customers?.full_name || 'Customer'}</div>
                                  <div className="opacity-80 truncate">{td.vehicles?.brand} {td.vehicles?.model}</div>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── MONTH VIEW ── */}
              {calendarViewType === 'month' && (
                <div className="flex flex-col flex-1">
                  {/* Day of week headers */}
                  <div className="grid grid-cols-7 border-b border-border">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                      <div key={d} className="py-2 text-center text-[10px] uppercase tracking-wide font-medium text-muted-foreground border-r border-border last:border-r-0">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 flex-1">
                    {calendarMonthGrid.map((day, idx) => {
                      const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                      const isToday = day.toDateString() === new Date().toDateString();
                      const drives = drivesOnDay(day);
                      const isSelected = calendarInsight?.type === 'day' && calendarInsight.date.toDateString() === day.toDateString();
                      return (
                        <button
                          key={idx}
                          onClick={() => setCalendarInsight({ type: 'day', date: day })}
                          className={`border-r border-b border-border last-of-type:border-r-0 p-1.5 text-left min-h-[80px] transition-colors hover:bg-primary/5 ${
                            !isCurrentMonth ? 'bg-muted/20' : ''} ${isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''}`}
                        >
                          <span className={`text-xs font-semibold inline-flex h-5 w-5 items-center justify-center rounded-full ${
                            isToday ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'
                          }`}>{day.getDate()}</span>
                          <div className="mt-1 space-y-0.5">
                            {drives.slice(0, 3).map((td) => (
                              <div key={td.id} className={`text-[9px] rounded px-1 py-0.5 truncate font-medium ${statusCalColor[td.status] ?? 'bg-slate-400 text-white'}`}>
                                {(td.scheduled_time || '').substring(0, 5)} {td.customers?.full_name}
                              </div>
                            ))}
                            {drives.length > 3 && (
                              <div className="text-[9px] text-muted-foreground font-medium">+{drives.length - 3} more</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── YEAR VIEW ── */}
              {calendarViewType === 'year' && (
                <div className="flex-1 p-4 grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto">
                  {MONTHS.map((mon, idx) => {
                    const drives = drivesInMonth(calendarDate.getFullYear(), idx);
                    const total = drives.length;
                    const completed = drives.filter((d) => d.status === 'completed').length;
                    const inProgress = drives.filter((d) => d.status === 'in_progress').length;
                    const isCurrentMonth = idx === new Date().getMonth() && calendarDate.getFullYear() === new Date().getFullYear();
                    const isSelected = calendarInsight?.type === 'month' && calendarInsight.date.getMonth() === idx && calendarInsight.date.getFullYear() === calendarDate.getFullYear();
                    return (
                      <button
                        key={mon}
                        onClick={() => { const d = new Date(calendarDate.getFullYear(), idx, 1); setCalendarInsight({ type: 'month', date: d }); }}
                        className={`rounded-xl border p-3 text-left transition-all hover:shadow-md hover:border-primary/40 ${
                          isSelected ? 'border-primary bg-primary/5 shadow-md' : isCurrentMonth ? 'border-primary/30 bg-primary/[0.03]' : 'border-border bg-card'
                        }`}
                      >
                        <div className={`text-sm font-bold ${isCurrentMonth ? 'text-primary' : 'text-foreground'}`}>{MONTH_FULL[idx]}</div>
                        <div className="mt-2 text-2xl font-black text-foreground">{total}</div>
                        <div className="text-[10px] text-muted-foreground mb-2">test drives</div>
                        {total > 0 && (
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${Math.round((completed / total) * 100)}%` }}
                            />
                          </div>
                        )}
                        <div className="mt-1.5 flex gap-1.5 flex-wrap">
                          {completed > 0 && <span className="text-[9px] bg-green-100 text-green-700 rounded px-1 py-0.5">{completed} done</span>}
                          {inProgress > 0 && <span className="text-[9px] bg-orange-100 text-orange-700 rounded px-1 py-0.5">{inProgress} active</span>}
                        </div>
                      </button>
                    );
                  })}
                  {/* Year total card */}
                  <button
                    onClick={() => setCalendarInsight({ type: 'year', date: new Date(calendarDate.getFullYear(), 0, 1) })}
                    className={`rounded-xl border p-3 text-left transition-all hover:shadow-md hover:border-primary/40 col-span-1 ${
                      calendarInsight?.type === 'year' ? 'border-primary bg-primary/5 shadow-md' : 'border-dashed border-border'
                    }`}
                  >
                    <div className="text-sm font-bold text-foreground">Full Year</div>
                    <div className="mt-2 text-2xl font-black text-primary">{drivesInYear(calendarDate.getFullYear()).length}</div>
                    <div className="text-[10px] text-muted-foreground">total drives {calendarDate.getFullYear()}</div>
                  </button>
                </div>
              )}
            </div>

            {/* ── Right: Insight Panel ── */}
            <div className="w-80 shrink-0 rounded-xl border border-border bg-card shadow-card flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Insights
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{insightLabel}</div>
                </div>
                {calendarInsight && (
                  <button onClick={() => { setCalendarInsight(null); setCalendarSelectedDrive(null); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {!calendarInsight ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
                  <CalendarClock className="h-10 w-10 opacity-20" />
                  <p className="text-sm font-medium">Select a period</p>
                  <p className="text-xs">Click any day, week header, month card, or year total to see insights</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* Stats grid */}
                  <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                      <div className="text-2xl font-black text-foreground">{insightStats.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Total Drives</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-black text-green-600">{insightStats.byStatus.completed || 0}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Completed</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-black text-blue-600">{insightStats.completionRate}%</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Completion Rate</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-black text-orange-500">{insightStats.showRate}%</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Show Rate</div>
                    </div>
                  </div>

                  {/* Status breakdown */}
                  <div className="px-4 py-3 border-b border-border space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status Breakdown</p>
                    {Object.entries(insightStats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${statusDotColor[status] ?? 'bg-slate-400'}`} />
                        <span className="text-xs text-foreground capitalize flex-1">{status.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-semibold text-foreground">{count as number}</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${statusDotColor[status] ?? 'bg-slate-400'}`}
                            style={{ width: `${Math.round(((count as number) / insightStats.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Drive list */}
                  <div className="px-4 py-3 flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                      Drives ({insightDrives.length})
                    </p>
                    <div className="space-y-1.5">
                      {insightDrives.slice(0, 20).map((td) => (
                        <button
                          key={td.id}
                          onClick={() => setCalendarSelectedDrive(td)}
                          className={`w-full text-left flex items-center gap-2 rounded-lg px-2 py-2 transition-colors ${
                            calendarSelectedDrive?.id === td.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full shrink-0 ${statusDotColor[td.status] ?? 'bg-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{td.customers?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{td.scheduled_date} · {(td.scheduled_time || '').substring(0, 5)} · {td.vehicles?.brand} {td.vehicles?.model}</p>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize shrink-0 ${statusCalColor[td.status] ?? 'bg-slate-400 text-white'}`}>
                            {td.status.replace(/_/g, ' ')}
                          </span>
                        </button>
                      ))}
                      {insightDrives.length > 20 && (
                        <p className="text-[10px] text-muted-foreground text-center py-1">+{insightDrives.length - 20} more drives</p>
                      )}
                    </div>
                  </div>

                  {/* Selected drive detail */}
                  {calendarSelectedDrive && (
                    <div className="border-t border-border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-foreground">{calendarSelectedDrive.customers?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{calendarSelectedDrive.customers?.phone}</p>
                          </div>
                        </div>
                        <button onClick={() => setCalendarSelectedDrive(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Car className="h-3 w-3 text-primary" />{calendarSelectedDrive.vehicles?.brand} {calendarSelectedDrive.vehicles?.model}</div>
                        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-primary" />{calendarSelectedDrive.scheduled_date} at {(calendarSelectedDrive.scheduled_time || '').substring(0, 5)}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" />{calendarSelectedDrive.locations?.name}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 text-[11px] h-7" onClick={() => { setDetailSheetDrive(calendarSelectedDrive); setCalendarSelectedDrive(null); }}>
                          Full Details
                        </Button>
                        <Button size="sm" variant="outline" className="text-[11px] h-7 px-2" onClick={() => setJourneyDrive(calendarSelectedDrive)}>
                          <Route className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Grid View ─────────────────────────────────────────────────── */}
        {viewMode === 'grid' && testDrives.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center text-muted-foreground">No test drives found for the selected filter</CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="space-y-6">
            {displayGroups.map(({ label, drives }) => (
              <div key={label || ''}>
                {label && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <User className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm text-foreground">{label}</span>
                    <Badge variant="secondary" className="text-xs">{drives.length}</Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {drives.map((td) => {
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
                      {td.assigned_sales_person?.full_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />{td.assigned_sales_person.full_name}
                        </span>
                      )}
                      {td.assigned_security_person?.full_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3 shrink-0" />{td.assigned_security_person.full_name}
                        </span>
                      )}
                      {journeyBadge && (
                        <Badge variant="secondary" className={`text-[10px] ${durationBadgeClass[journeyBadge]}`}>{journeyBadge}</Badge>
                      )}
                      {durationMinutes !== null && (
                        <span className="text-[10px] text-muted-foreground">{durationMinutes}m</span>
                      )}
                      {td.created_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(td.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      )}
                    </div>

                    {/* ── In-progress context hint ── */}
                    {td.status === 'in_progress' && (
                      <div className="flex items-start gap-1.5 text-[11px] bg-accent/10 border border-accent/30 rounded-md px-2 py-1.5 text-accent-foreground">
                        <PlayCircle className="h-3 w-3 shrink-0 mt-px text-primary" />
                        <span>
                          Customer is currently on the test drive.{' '}
                          {(td.security_checked_in_at || td.key_handed_at) && (
                            <>Started at {new Date(td.security_checked_in_at || td.key_handed_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}. </>
                          )}
                          {td.assigned_security_person?.full_name && (
                            <>Security: <span className="font-medium">{td.assigned_security_person.full_name}</span>. </>
                          )}
                          Next: wait for return → Security checkout → Key handover to sales.
                        </span>
                      </div>
                    )}

                    {/* ── Route info (if set) ── */}
                    {td.metadata?.route_destination && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5 border border-border">
                        <Route className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate flex-1">{String(td.metadata.route_destination)}</span>
                        {td.metadata.route_distance_km != null && (
                          <span className="shrink-0 text-primary font-medium">{String(td.metadata.route_distance_km)} km</span>
                        )}
                        {td.metadata.route_duration_minutes != null && (
                          <span className="shrink-0">~{Math.floor(Number(td.metadata.route_duration_minutes) / 60) > 0
                            ? `${Math.floor(Number(td.metadata.route_duration_minutes) / 60)}h ${Math.round(Number(td.metadata.route_duration_minutes) % 60)}m`
                            : `${Math.round(Number(td.metadata.route_duration_minutes))}m`
                          }</span>
                        )}
                      </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-border" onClick={e => e.stopPropagation()}>
                      {/* Always-visible: Journey */}
                      <Button size="sm" variant="outline" className="text-xs border-primary/40 text-primary hover:bg-primary/10" onClick={() => setJourneyDrive(td)}>
                        <Route className="h-3 w-3 mr-1" /> Journey
                      </Button>

                      {/* Primary contextual action */}
                      {td.status === 'cancelled' && (
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => setRebookDrive(td)}>
                          <PlusCircle className="h-3 w-3 mr-1" /> New Test Drive
                        </Button>
                      )}
                      {td.status === 'key_handover_to_sales' && ([APP_ROLE.SALES, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && (
                        <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => handleKeyHandoverComplete(td)}>
                          <FileCheck className="h-3 w-3 mr-1" /> Key Handover
                        </Button>
                      )}
                      {(td.status === 'show' || td.status === 'scheduled' || td.status === 'rescheduled') && !td.key_handed_at && td.customers?.driving_license_verified && ([APP_ROLE.SALES, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && td.status !== 'key_handover_to_sales' && (
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => handleAssignKey(td.id)} disabled={assigningKey === td.id}>
                          <Key className="h-3 w-3 mr-1" /> Assign Key
                        </Button>
                      )}
                      {td.status === 'scheduled' && ([APP_ROLE.GRO, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && !td.key_handed_at && (
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => updateStatus(td.id, 'confirmed')}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                      )}

                      {/* Overflow menu — only shown when at least one item is available */}
                      {(() => {
                        const hasReschedule = (['scheduled', 'confirmed', 'show', 'no_show', 'rescheduled'] as string[]).includes(td.status);
                        const hasNoShow = (['scheduled', 'confirmed', 'show', 'rescheduled'] as string[]).includes(td.status);
                        const hasLead = canCreateOpportunity && (['completed', 'key_handover_to_sales'] as string[]).includes(td.status) && td.scheduled_date && new Date(td.scheduled_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                        const hasCancel = (['scheduled', 'confirmed', 'rescheduled'] as string[]).includes(td.status);
                        if (!hasReschedule && !hasNoShow && !hasLead && !hasCancel) return null;
                        return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs px-2 ml-auto">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {(['scheduled', 'confirmed', 'show', 'no_show', 'rescheduled'] as string[]).includes(td.status) && (
                            <DropdownMenuItem onClick={() => setRescheduleId(td.id)}>
                              <RefreshCw className="h-3.5 w-3.5 mr-2 text-info" /> Reschedule
                            </DropdownMenuItem>
                          )}
                          {(['scheduled', 'confirmed', 'show', 'rescheduled'] as string[]).includes(td.status) && ([APP_ROLE.GRO, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role ?? '') && (
                            <DropdownMenuItem onClick={() => updateStatus(td.id, 'show')}>
                              <CheckCircle className="h-3.5 w-3.5 mr-2 text-success" /> Mark Show
                            </DropdownMenuItem>
                          )}
                          {(['scheduled', 'confirmed', 'show', 'rescheduled'] as string[]).includes(td.status) && (
                            <DropdownMenuItem onClick={() => setNoShowId(td.id)}>
                              <CalendarX className="h-3.5 w-3.5 mr-2 text-warning" /> No Show
                            </DropdownMenuItem>
                          )}
                          {canCreateOpportunity && (['completed', 'key_handover_to_sales'] as string[]).includes(td.status) && td.scheduled_date && new Date(td.scheduled_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                            <DropdownMenuItem onClick={() => { setLeadDialogDrive(td); setLeadTemperature('cold'); setFollowUpTaskTitle(''); setFollowUpTaskDueAt(''); }}>
                              <TrendingUp className="h-3.5 w-3.5 mr-2 text-warning" /> Create Lead
                            </DropdownMenuItem>
                          )}
                          {(['scheduled', 'confirmed', 'rescheduled'] as string[]).includes(td.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setCancelId(td.id)}>
                                <Ban className="h-3.5 w-3.5 mr-2" /> Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

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
                  if (profile?.user_id) {
                    void logStaffActivity({
                      userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
                      eventType: 'test_drive_no_show',
                      label: 'Marked test drive as no-show',
                      route: '/test-drives',
                      metadata: { testDriveId: noShowId },
                    });
                  }
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
                <Input type="datetime-local"   
                min={todayStr}
                      max={maxDateStr} 
                      value={followUpTaskDueAt} onChange={(e) => setFollowUpTaskDueAt(e.target.value)} />
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

        <WalkinDialog
          open={!!rebookDrive}
          onClose={(submitted) => { setRebookDrive(null); if (submitted) fetchTestDrives(); }}
          defaultLocationId={rebookDrive?.location_id}
          defaultVehicleId={rebookDrive?.vehicle_id}
          rebookCustomerId={rebookDrive?.customer_id}
          defaultCustomerName={rebookDrive?.customers?.full_name}
          defaultCustomerPhone={rebookDrive?.customers?.phone}
          rebookCustomerEmail={rebookDrive?.customers?.email}
        />
      </div>
    </DashboardLayout>
  );
};

export default TestDrivesPage;
