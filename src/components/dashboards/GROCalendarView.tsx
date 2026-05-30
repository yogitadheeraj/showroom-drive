import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, UserPlus, UserPen, RefreshCw, AlertTriangle } from 'lucide-react';
import WalkinDialog from '@/components/WalkinDialog';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';

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

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;
const ASSIGNABLE_STATUSES = new Set(['new', 'scheduled', 'confirmed', 'show', 'no_show']);

const getLocationSlotDuration = (location: any) => {
  const fromColumn = Number(location?.slot_duration_minutes);
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn;

  const fromMetadata = Number(location?.metadata?.slot_duration_minutes);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata;

  return 30;
};

const toMinutes = (time?: string | null) => {
  if (!time) return null;
  const [hour, minute] = time.substring(0, 5).split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
};

const extractHour = (time?: string | null) => {
  if (!time) return null;
  const normalized = time.trim().toLowerCase();

  // Supports "HH:mm(:ss)" and "h:mm am/pm" formats.
  if (normalized.includes('am') || normalized.includes('pm')) {
    const parts = normalized.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
    if (!parts) return null;
    let hour = Number(parts[1]);
    const meridiem = parts[3];
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return Number.isNaN(hour) ? null : hour;
  }

  const hour = Number(normalized.substring(0, 2));
  return Number.isNaN(hour) ? null : hour;
};

const GROCalendarView = () => {
  const { profile } = useAuth();
  const navigateTo = useNavigate();
  const { toast } = useToast();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [locationVehicles, setLocationVehicles] = useState<any[]>([]);
  const [locationDetails, setLocationDetails] = useState<any | null>(null);
  const [operatingHours, setOperatingHours] = useState<any[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [specialPeriods, setSpecialPeriods] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; testDriveId: string | null }>({ open: false, testDriveId: null });
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');
  const [selectedModelGroup, setSelectedModelGroup] = useState('all');
  const [selectedSalesFilter, setSelectedSalesFilter] = useState('all');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [noShowConfirmId, setNoShowConfirmId] = useState<string | null>(null);
  const [walkinDialog, setWalkinDialog] = useState<{ open: boolean; date?: string; time?: string }>({ open: false });

  useEffect(() => {
    void fetchTestDrives();
    void fetchLocationVehicles();
    void fetchLocationScheduling();
    void fetchSalesPersons();
  }, [profile?.location_id, currentDate, viewMode]);

  // Real-time: auto-refresh + toast when any test drive status changes
  useTestDriveRealtime(profile?.location_id, (event) => {
    toast({
      title: 'Test Drive Updated',
      description: `${event.customer_name} — ${event.vehicle_name} is now "${event.status.replace(/_/g, ' ')}"`,
    });
    void fetchTestDrives();
  });

  const fetchTestDrives = async () => {
    if (!profile?.location_id) {
      setTestDrives([]);
      return;
    }
    const startDate = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
    const endDate = viewMode === 'week' ? addDays(startDate, 6) : currentDate;
    const params = new URLSearchParams({
      location_id: profile.location_id,
      date_gte: format(startDate, 'yyyy-MM-dd'),
      date_lte: format(endDate, 'yyyy-MM-dd'),
    });
    const enriched = await apiGet<any[]>(`/api/test-drives?${params.toString()}`) || [];
    setTestDrives(enriched);
  };

  const fetchSalesPersons = async () => {
    if (!profile?.location_id) {
      setSalesPersons([]);
      return;
    }

    const rolesData = await apiGet<any[]>('/api/user-roles');
    const assignableRoleUserIds = Array.from(
      new Set(
        (rolesData || [])
          .filter((role) => ['sales', 'sales_admin', 'branch_admin'].includes(String(role.role || '').toLowerCase()))
          .map((role) => role.user_id)
          .filter(Boolean),
      ),
    );

    if (!assignableRoleUserIds.length) {
      setSalesPersons([]);
      return;
    }

    const profiles = await apiGet<any[]>(`/api/profiles?location_id=${encodeURIComponent(profile.location_id)}&is_active=true`);
    const filteredProfiles = (profiles || []).filter((item) => assignableRoleUserIds.includes(item.user_id));
    filteredProfiles.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')));

    const locationIds = Array.from(new Set(filteredProfiles.map((item) => item.location_id).filter(Boolean)));
    const locationRows = locationIds.length
      ? await apiGet<any[]>(`/api/locations?ids=${encodeURIComponent(locationIds.join(','))}`)
      : [];
    const locationMap = new Map((locationRows || []).map((location) => [location.id, location]));

    setSalesPersons(
      filteredProfiles.map((item) => ({
        ...item,
        locations: item.location_id ? locationMap.get(item.location_id) || null : null,
      })),
    );
  };

  const fetchLocationVehicles = async () => {
    if (!profile?.location_id) {
      setLocationVehicles([]);
      return;
    }

    const data = await apiGet<any[]>(
      `/api/vehicles?location_id=${encodeURIComponent(profile.location_id)}&is_active=true&is_available=true`,
    );

    setLocationVehicles(data || []);
  };

  const fetchLocationScheduling = async () => {
    if (!profile?.location_id) {
      setLocationDetails(null);
      setOperatingHours([]);
      setBlockedSlots([]);
      setSpecialPeriods([]);
      return;
    }

    const [location, hours, blocked, special] = await Promise.all([
      apiGet<any>(`/api/locations/${encodeURIComponent(profile.location_id)}`),
      apiGet<any[]>(`/api/location-operating-hours?location_id=${encodeURIComponent(profile.location_id)}`),
      apiGet<any[]>(`/api/location-blocked-slots?location_id=${encodeURIComponent(profile.location_id)}`),
      apiGet<any[]>(`/api/location-special-periods?location_id=${encodeURIComponent(profile.location_id)}`),
    ]);

    setLocationDetails(location || null);
    setOperatingHours(hours || []);
    setBlockedSlots(blocked || []);
    setSpecialPeriods(special || []);
  };

  const handleAssign = async () => {
    if (!assignDialog.testDriveId || !selectedSalesPerson) return;
    await apiPatch(`/api/test-drives/${encodeURIComponent(assignDialog.testDriveId)}`, {
      assigned_sales_person_id: selectedSalesPerson,
    });
    setAssignDialog({ open: false, testDriveId: null });
    setSelectedSalesPerson('');
    fetchTestDrives();
  };

  const updateStatus = async (id: string, status: string) => {
    await apiPatch(`/api/test-drives/${encodeURIComponent(id)}`, { status });
    fetchTestDrives();
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    const original = testDrives.find((t) => t.id === rescheduleId);
    if (!original) return;
    await apiPost('/api/test-drives', {
      customer_id: original.customer_id,
      vehicle_id: original.vehicle_id,
      location_id: original.location_id,
      assigned_sales_person_id: original.assigned_sales_person_id,
      assigned_gro_id: original.assigned_gro_id,
      scheduled_date: rescheduleDate,
      scheduled_time: rescheduleTime,
      source: original.source,
      rescheduled_from: rescheduleId,
    });
    await apiPatch(`/api/test-drives/${encodeURIComponent(rescheduleId)}`, { status: 'rescheduled' });
    setRescheduleId(null);
    setRescheduleDate('');
    setRescheduleTime('');
    fetchTestDrives();
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const modelGroups = useMemo(() => {
    const options = new Set<string>();
    locationVehicles.forEach((vehicle) => {
      const brand = vehicle?.brand || '';
      const model = vehicle?.model || '';
      const label = `${brand} ${model}`.trim();
      if (label) options.add(label);
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [locationVehicles]);

  const filteredTestDrives = useMemo(() => {
    return testDrives.filter((td) => {
      const modelLabel = `${td?.vehicles?.brand || ''} ${td?.vehicles?.model || ''}`.trim();
      const modelMatch = selectedModelGroup === 'all' || modelLabel === selectedModelGroup;

      const salesMatch = selectedSalesFilter === 'all'
        ? true
        : selectedSalesFilter === 'unassigned'
          ? !td.assigned_sales_person_id
          : td.assigned_sales_person_id === selectedSalesFilter;

      return modelMatch && salesMatch;
    });
  }, [testDrives, selectedModelGroup, selectedSalesFilter]);

  const bookingLink = useMemo(() => {
    if (selectedModelGroup === 'all') return '/book';
    return `/book?modelname=${encodeURIComponent(selectedModelGroup)}`;
  }, [selectedModelGroup]);

  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const plannerDates = viewMode === 'day' ? [currentDate] : weekDays;
  const plannerModels = selectedModelGroup === 'all' ? modelGroups : modelGroups.filter((model) => model === selectedModelGroup);

  const getEffectiveHoursForDate = (dateStr: string) => {
    if (!profile?.location_id) return null;

    const special = specialPeriods.find((period: any) =>
      period.location_id === profile.location_id &&
      period.start_date <= dateStr &&
      period.end_date >= dateStr
    );

    if (special) {
      if (special.is_full_closure) {
        return {
          is_closed: true,
          open_time: null,
          close_time: null,
        };
      }

      return {
        is_closed: false,
        open_time: special.modified_open_time,
        close_time: special.modified_close_time,
      };
    }

    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
    return operatingHours.find((hours: any) => hours.day_of_week === dayOfWeek) || null;
  };

  const visibleTimeSlots = useMemo(() => {
    const slotDuration = getLocationSlotDuration(locationDetails);
    const slotSet = new Set<string>();

    const plannerDateStrs = new Set(plannerDates.map((d) => format(d, 'yyyy-MM-dd')));

    plannerDates.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hours = getEffectiveHoursForDate(dateStr);
      if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return;

      const openMinutes = toMinutes(hours.open_time);
      const closeMinutes = toMinutes(hours.close_time);
      if (openMinutes === null || closeMinutes === null) return;

      for (let minutes = openMinutes; minutes + slotDuration <= closeMinutes; minutes += slotDuration) {
        const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
        const mm = String(minutes % 60).padStart(2, '0');
        slotSet.add(`${hh}:${mm}`);
      }
    });

    // Ensure test drives booked outside configured operating hours are still visible
    // by adding their time as a slot boundary (snapped to the slot grid).
    filteredTestDrives.forEach((td) => {
      if (!td.scheduled_date || !td.scheduled_time) return;
      if (!plannerDateStrs.has(td.scheduled_date.substring(0, 10))) return;
      const bookingMinutes = toMinutes(td.scheduled_time);
      if (bookingMinutes === null) return;
      const slotStart = Math.floor(bookingMinutes / slotDuration) * slotDuration;
      const hh = String(Math.floor(slotStart / 60)).padStart(2, '0');
      const mm = String(slotStart % 60).padStart(2, '0');
      slotSet.add(`${hh}:${mm}`);
    });

    const generatedSlots = Array.from(slotSet).sort((a, b) => (toMinutes(a) || 0) - (toMinutes(b) || 0));

    // Keep the planner usable even when schedule data is missing for the selected view window.
    if (generatedSlots.length === 0) {
      const fallbackSlots: string[] = [];
      const startMinutes = DEFAULT_START_HOUR * 60;
      const endMinutes = DEFAULT_END_HOUR * 60;
      for (let minutes = startMinutes; minutes + slotDuration <= endMinutes; minutes += slotDuration) {
        const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
        const mm = String(minutes % 60).padStart(2, '0');
        fallbackSlots.push(`${hh}:${mm}`);
      }
      return fallbackSlots;
    }

    return generatedSlots;
  }, [plannerDates, locationDetails, operatingHours, specialPeriods, filteredTestDrives]);

  const visibleHours = useMemo(() => {
    const viewDates = viewMode === 'day'
      ? [format(currentDate, 'yyyy-MM-dd')]
      : weekDays.map((day) => format(day, 'yyyy-MM-dd'));
    const viewDateSet = new Set(viewDates);

    const hoursInView = filteredTestDrives
      .filter((td) => td.scheduled_date && viewDateSet.has(td.scheduled_date))
      .map((td) => extractHour(td.scheduled_time))
      .filter((h): h is number => h !== null && h >= 0 && h <= 23);

    if (!hoursInView.length) {
      return Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR + 1 }, (_, i) => i + DEFAULT_START_HOUR);
    }

    const minHour = Math.min(DEFAULT_START_HOUR, ...hoursInView);
    const maxHour = Math.max(DEFAULT_END_HOUR, ...hoursInView);

    return Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  }, [filteredTestDrives, currentDate, viewMode, weekDays]);

  const getBookingsForSlot = (date: Date, hour: number) => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    return filteredTestDrives.filter(td => {
      const tdHour = extractHour(td.scheduled_time);
      if (tdHour === null) return false;
      return td.scheduled_date?.substring(0, 10) === targetDateStr && tdHour === hour;
    });
  };

  const getBookingsForModelDate = (date: Date, modelLabel: string) => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    return filteredTestDrives.filter((td) => {
      if (!td.scheduled_date) return false;
      const label = `${td?.vehicles?.brand || ''} ${td?.vehicles?.model || ''}`.trim();
      return td.scheduled_date.substring(0, 10) === targetDateStr && label === modelLabel;
    });
  };

  const getBookingsForTimeSlot = (date: Date, startTime: string) => {
    const slotDuration = getLocationSlotDuration(locationDetails);
    const slotStartMinutes = toMinutes(startTime);
    if (slotStartMinutes === null) return [];
    const slotEndMinutes = slotStartMinutes + slotDuration;
    const targetDateStr = format(date, 'yyyy-MM-dd');

    return filteredTestDrives.filter((td) => {
      if (!td.scheduled_date || !td.scheduled_time) return false;
      if (td.scheduled_date.substring(0, 10) !== targetDateStr) return false;

      const bookingStartMinutes = toMinutes(td.scheduled_time);
      if (bookingStartMinutes === null) return false;

      // Place each booking in the slot window where its start time falls,
      // so non-boundary times like 14:17 still appear in the planner.
      return bookingStartMinutes >= slotStartMinutes && bookingStartMinutes < slotEndMinutes;
    });
  };

  const isSlotBlocked = (date: Date, startTime: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slotDuration = getLocationSlotDuration(locationDetails);
    const slotStart = toMinutes(startTime);
    const slotEnd = slotStart === null ? null : slotStart + slotDuration;

    return blockedSlots.some((blocked: any) => {
      if (blocked.blocked_date !== dateStr || slotStart === null || slotEnd === null) return false;
      const blockedStart = toMinutes(blocked.start_time);
      const blockedEnd = toMinutes(blocked.end_time);
      if (blockedStart === null || blockedEnd === null) return false;
      return !(slotEnd <= blockedStart || slotStart >= blockedEnd);
    });
  };

  const isPastSlot = (date: Date, startTime: string) => {
    const startMinutes = toMinutes(startTime);
    if (startMinutes === null) return false;

    const slotDateTime = new Date(date);
    slotDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

    return slotDateTime < new Date();
  };

  const isSlotAvailableForSelectedModel = (date: Date, startTime: string) => {
    if (selectedModelGroup === 'all') return true;
    if (isPastSlot(date, startTime)) return false;
    if (isSlotBlocked(date, startTime)) return false;

    const modelVehiclesForSlot = locationVehicles.filter((vehicle) => `${vehicle.brand} ${vehicle.model}`.trim() === selectedModelGroup);
    if (!modelVehiclesForSlot.length) return false;

    const slotDuration = getLocationSlotDuration(locationDetails);
    const slotStart = toMinutes(startTime);
    const slotEnd = slotStart === null ? null : slotStart + slotDuration;
    if (slotStart === null || slotEnd === null) return false;

    return modelVehiclesForSlot.some((vehicle) => {
      const overlaps = testDrives.filter((td) => {
        if (td.vehicle_id !== vehicle.id || !td.scheduled_time || td.scheduled_date !== format(date, 'yyyy-MM-dd')) return false;
        if (!['scheduled', 'confirmed', 'show', 'in_progress'].includes(td.status)) return false;

        const bookingStart = toMinutes(td.scheduled_time);
        const bookingDuration = Number(td.slot_duration_minutes || slotDuration);
        const bookingEnd = bookingStart === null ? null : bookingStart + bookingDuration;
        if (bookingStart === null || bookingEnd === null) return false;

        return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
      }).length;

      const capacity = Number(vehicle.available_units || 1);
      return overlaps < capacity;
    });
  };

  const buildBookingLink = (modelLabel: string, date: Date, time?: string) => {
    const params = new URLSearchParams({
      modelname: modelLabel,
      scheduledDate: format(date, 'yyyy-MM-dd'),
    });

    if (time) {
      params.set('scheduledTime', time);
    }

    if (profile?.location_id) {
      params.set('locationId', profile.location_id);
    }

    return `/book?${params.toString()}`;
  };

  const buildBookingLinkWithoutModel = (date: Date, time?: string) => {
    const params = new URLSearchParams({
      scheduledDate: format(date, 'yyyy-MM-dd'),
    });

    if (time) {
      params.set('scheduledTime', time);
    }

    if (profile?.location_id) {
      params.set('locationId', profile.location_id);
    }

    return `/book?${params.toString()}`;
  };

  const renderCalendarSlot = (date: Date, slotTime: string) => {
    const slotBookings = getBookingsForTimeSlot(date, slotTime);
    const slotPast = isPastSlot(date, slotTime);
    const slotDisabled = slotPast || (selectedModelGroup !== 'all' && !isSlotAvailableForSelectedModel(date, slotTime));
    return (
      <div className="space-y-1">
        {selectedModelGroup !== 'all' ? (
          <div className={`rounded-md border border-dashed px-2 py-1 text-[11px] font-medium ${
            slotDisabled
              ? 'border-border bg-muted text-muted-foreground'
              : 'border-primary/25 bg-primary/5 text-primary'
          }`}>
            {slotPast ? `Past Slot ${slotTime}` : slotDisabled ? `Booked Out at ${slotTime}` : `Book ${selectedModelGroup} at ${slotTime}`}
          </div>
        ) : slotPast ? (
          <div className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground bg-muted">
            Past Slot {slotTime}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setWalkinDialog({ open: true, date: format(date, 'yyyy-MM-dd'), time: slotTime })}
            className="block w-full rounded-md border border-dashed border-primary/25 px-2 py-1 text-[11px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left"
          >
            + Book Walk-in at {slotTime}
          </button>
        )}
        {slotBookings.map(renderBookingCard)}
      </div>
    );
  };

  const navigate = (dir: number) => {
    setCurrentDate(prev => addDays(prev, viewMode === 'week' ? dir * 7 : dir));
  };

  const handleDatePlannerClick = (date: Date, slotTime: string) => {
    if (isPastSlot(date, slotTime)) return;
    setWalkinDialog({ open: true, date: format(date, 'yyyy-MM-dd'), time: slotTime });
  };

  const renderBookingCard = (td: any) => {
    const source = (td.source || '').toLowerCase();
    const canAssignByStatus = ASSIGNABLE_STATUSES.has(td.status);
    const canAssignBySource = source === 'online' || source === 'walkin';
    const canAssign = td.status !== 'completed' && td.status !== 'cancelled' && (canAssignByStatus || canAssignBySource);
    const isIncomplete = ['scheduled', 'confirmed', 'show', 'no_show'].includes(td.status);
    const canMarkNoShow = ['scheduled', 'confirmed', 'show'].includes(td.status);

    return (
    <div key={td.id} className={`p-2 rounded-md border text-xs mb-1 ${statusColor[td.status] || 'bg-muted'}`}>
      <p className="font-medium truncate">{td.customers?.full_name}</p>
      <p className="truncate opacity-80">{td.vehicles?.brand} {td.vehicles?.model}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
          {formatStatusLabel(td.status || 'scheduled')}
        </Badge>
        {td.source && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 capitalize">
            {td.source}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between mt-1 gap-1">
        {td.assigned_sales_person?.full_name ? (
          <span className="text-[10px] font-medium bg-background/50 px-1.5 py-0.5 rounded truncate">{td.assigned_sales_person?.full_name}</span>
        ) : (
          <span className="text-[10px] italic opacity-60">Unassigned</span>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          {canAssign && (
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" title={td.assigned_sales_person?.full_name ? 'Reassign' : 'Assign'}
              onClick={(e) => { e.stopPropagation(); setAssignDialog({ open: true, testDriveId: td.id }); setSelectedSalesPerson(td.assigned_sales_person_id || ''); }}>
              {td.assigned_sales_person?.full_name ? <UserPen className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
            </Button>
          )}
          {isIncomplete && (
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-info hover:bg-info/10 hover:text-info" title="Reschedule"
              onClick={(e) => { e.stopPropagation(); setRescheduleId(td.id); setRescheduleDate(''); setRescheduleTime(''); }}>
              <RefreshCw className="h-2.5 w-2.5" />
            </Button>
          )}
          {canMarkNoShow && (
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-warning hover:bg-warning/10 hover:text-warning" title="Mark No Show"
              onClick={(e) => { e.stopPropagation(); setNoShowConfirmId(td.id); }}>
              <AlertTriangle className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-5 pt-3 sm:pt-5">
      <Tabs defaultValue="date-planner" className="space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-card/80 shadow-card p-3 sm:p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-heading font-semibold text-foreground min-w-[200px] text-center">
                {viewMode === 'day'
                  ? format(currentDate, 'EEEE, MMM d, yyyy')
                  : `${format(weekDays[0], 'MMM d')} — ${format(weekDays[6], 'MMM d, yyyy')}`
                }
              </h2>
              <Button variant="outline" size="sm" onClick={() => navigate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                >
                  <Calendar className="h-4 w-4 mr-1" /> Day
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" /> Week
                </Button>
              </div>

              <div className={`w-full sm:w-auto ${viewMode === 'week' ? 'overflow-x-auto sm:overflow-visible' : ''}`}>
                <TabsList className={`grid grid-cols-2 sm:flex rounded-xl border border-border bg-card p-1 ${viewMode === 'week' ? 'min-w-[240px]' : ''}`}>
                  <TabsTrigger value="date-planner" className="text-xs sm:text-sm">Date Planner</TabsTrigger>
                  <TabsTrigger value="model-planner" className="text-xs sm:text-sm">Model Planner</TabsTrigger>
                </TabsList>
              </div>

              <Select value={selectedModelGroup} onValueChange={setSelectedModelGroup}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="All Model Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Model Groups</SelectItem>
                  {modelGroups.map((model) => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSalesFilter} onValueChange={setSelectedSalesFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="All Sales Persons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Persons</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {salesPersons.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button className="w-full md:w-auto" onClick={() => setWalkinDialog({ open: true, date: format(currentDate, 'yyyy-MM-dd') })}>
                + Book Walk-in
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="model-planner">
          <Card className="shadow-card overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Model Planner</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="p-3 text-left text-muted-foreground font-medium border-r border-border min-w-[130px]">Date</th>
                      {plannerModels.map((model) => (
                        <th key={model} className="p-3 text-left text-foreground font-medium border-l border-border min-w-[220px]">
                          {model}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plannerDates.map((date) => (
                      <tr key={date.toISOString()} className="border-t border-border/50">
                        <td className="p-3 align-top border-r border-border bg-muted/10">
                          <p className="font-medium text-foreground">{format(date, 'EEE')}</p>
                          <p className="text-xs text-muted-foreground">{format(date, 'dd MMM yyyy')}</p>
                        </td>
                        {plannerModels.map((model) => {
                          const bookings = getBookingsForModelDate(date, model);
                          return (
                            <td key={`${date.toISOString()}-${model}`} className="p-2 align-top border-l border-border/50">
                              <button type="button" onClick={() => setWalkinDialog({ open: true, date: format(date, 'yyyy-MM-dd') })} className="block w-full rounded-xl border border-dashed border-primary/25 bg-primary/5 p-3 hover:bg-primary/10 transition-colors text-left">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-semibold text-primary">Book Walk-in</p>
                                    <p className="text-[11px] text-muted-foreground">Date preselected — opens walk-in form</p>
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">
                                    {bookings.length} Booking{bookings.length === 1 ? '' : 's'}
                                  </Badge>
                                </div>
                                {bookings.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {bookings.slice(0, 2).map((booking) => (
                                      <div key={booking.id} className="rounded-lg bg-background/80 px-2 py-1 text-[11px] text-foreground border border-border/60">
                                        {booking.scheduled_time} • {booking.customers?.full_name || 'Customer'}
                                      </div>
                                    ))}
                                    {bookings.length > 2 && (
                                      <p className="text-[11px] text-muted-foreground">+{bookings.length - 2} more bookings</p>
                                    )}
                                  </div>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="date-planner">
          <Card className="shadow-card overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Date Planner</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="p-2 text-left text-muted-foreground font-medium w-20 border-r border-border">Time</th>
                      {viewMode === 'day' ? (
                        <th className="p-2 text-center text-foreground font-medium">
                          {format(currentDate, 'EEEE, MMM d')}
                        </th>
                      ) : (
                        weekDays.map(day => (
                          <th key={day.toISOString()} className={`p-2 text-center font-medium border-l border-border min-w-[140px] ${isSameDay(day, new Date()) ? 'text-primary bg-primary/5' : 'text-foreground'}`}>
                            <div>{format(day, 'EEE')}</div>
                            <div className="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTimeSlots.map((slotTime) => (
                      <tr key={slotTime} className="border-t border-border/50">
                        <td className="p-2 text-xs text-muted-foreground align-top border-r border-border font-mono">
                          {slotTime}
                        </td>
                        {viewMode === 'day' ? (
                          <td
                            className={`p-1 align-top min-h-[60px] ${selectedModelGroup !== 'all' && !isPastSlot(currentDate, slotTime) && isSlotAvailableForSelectedModel(currentDate, slotTime) ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                            onClick={() => handleDatePlannerClick(currentDate, slotTime)}
                          >
                            {renderCalendarSlot(currentDate, slotTime)}
                          </td>
                        ) : (
                          weekDays.map(day => (
                            <td
                              key={day.toISOString()}
                              className={`p-1 align-top border-l border-border/50 min-h-[60px] ${selectedModelGroup !== 'all' && !isPastSlot(day, slotTime) && isSlotAvailableForSelectedModel(day, slotTime) ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                              onClick={() => handleDatePlannerClick(day, slotTime)}
                            >
                              {renderCalendarSlot(day, slotTime)}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign/Reassign Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => !o && setAssignDialog({ open: false, testDriveId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selectedSalesPerson ? 'Reassign' : 'Assign'} Sales Person
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedSalesPerson} onValueChange={setSelectedSalesPerson}>
              <SelectTrigger>
                <SelectValue placeholder="Select sales person" />
              </SelectTrigger>
              <SelectContent>
                {salesPersons.map(sp => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.full_name}{sp.locations?.name ? ` — ${sp.locations.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} className="w-full" disabled={!selectedSalesPerson}>
              Confirm Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleId} onOpenChange={(o) => !o && setRescheduleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reschedule Test Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Input type="date" value={rescheduleDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setRescheduleDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>New Time</Label>
              <Input type="time" value={rescheduleTime} min={rescheduleDate === new Date().toISOString().split('T')[0] ? `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}` : undefined} onChange={(e) => setRescheduleTime(e.target.value)} />
            </div>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || !rescheduleTime}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Show Confirmation Dialog */}
      <Dialog open={!!noShowConfirmId} onOpenChange={(o) => !o && setNoShowConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Mark as No Show?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const td = testDrives.find(t => t.id === noShowConfirmId);
              return td
                ? `Are you sure you want to mark ${td.customers?.full_name || 'this customer'}'s test drive as no-show?`
                : 'Are you sure you want to mark this test drive as no-show?';
            })()}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setNoShowConfirmId(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => { updateStatus(noShowConfirmId!, 'no_show'); setNoShowConfirmId(null); }}
            >
              Yes, Mark No Show
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WalkinDialog
        open={walkinDialog.open}
        defaultDate={walkinDialog.date}
        defaultTime={walkinDialog.time}
        defaultLocationId={profile?.location_id}
        onClose={(submitted) => {
          setWalkinDialog({ open: false });
          if (submitted) void fetchTestDrives();
        }}
      />
    </div>
  );
};

export default GROCalendarView;
