import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, UserPlus, RefreshCw } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';

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

  useEffect(() => {
    void fetchTestDrives();
    void fetchLocationVehicles();
    void fetchLocationScheduling();
    void fetchSalesPersons();
  }, [profile?.location_id, currentDate, viewMode]);

  const fetchTestDrives = async () => {
    if (!profile?.location_id) {
      setTestDrives([]);
      return;
    }
    const startDate = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
    const endDate = viewMode === 'week' ? addDays(startDate, 6) : currentDate;

    const { data } = await supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*), profiles!test_drives_assigned_sales_person_id_fkey(id, full_name)')
      .eq('location_id', profile.location_id)
      .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
      .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'))
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    setTestDrives(data || []);
  };

  const fetchSalesPersons = async () => {
    if (!profile?.location_id) {
      setSalesPersons([]);
      return;
    }

    const { data: rolesData } = await supabase.from('user_roles').select('user_id').eq('role', 'sales');
    if (!rolesData?.length) { setSalesPersons([]); return; }
    const userIds = rolesData.map(r => r.user_id);
    const { data } = await supabase.from('profiles')
      .select('id, full_name, user_id, location_id, locations(name)')
      .eq('location_id', profile.location_id)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .in('user_id', userIds);
    setSalesPersons(data || []);
  };

  const fetchLocationVehicles = async () => {
    if (!profile?.location_id) {
      setLocationVehicles([]);
      return;
    }

    const { data } = await supabase.from('vehicles')
      .select('id, brand, model, location_id, available_units, total_units')
      .eq('location_id', profile.location_id)
      .eq('is_active', true)
      .eq('is_available', true)
      .order('brand', { ascending: true })
      .order('model', { ascending: true });

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

    const [locationRes, hoursRes, blockedRes, specialRes] = await Promise.all([
      supabase.from('locations').select('*').eq('id', profile.location_id).maybeSingle(),
      supabase.from('location_operating_hours').select('*').eq('location_id', profile.location_id),
      supabase.from('location_blocked_slots').select('*').eq('location_id', profile.location_id),
      supabase.from('location_special_periods').select('*').eq('location_id', profile.location_id),
    ]);

    setLocationDetails(locationRes.data || null);
    setOperatingHours(hoursRes.data || []);
    setBlockedSlots(blockedRes.data || []);
    setSpecialPeriods(specialRes.data || []);
  };

  const handleAssign = async () => {
    if (!assignDialog.testDriveId || !selectedSalesPerson) return;
    await supabase.from('test_drives')
      .update({ assigned_sales_person_id: selectedSalesPerson })
      .eq('id', assignDialog.testDriveId);
    setAssignDialog({ open: false, testDriveId: null });
    setSelectedSalesPerson('');
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
  }, [plannerDates, locationDetails, operatingHours, specialPeriods]);

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
    return filteredTestDrives.filter(td => {
      const tdDate = parseISO(td.scheduled_date);
      const tdHour = extractHour(td.scheduled_time);
      if (tdHour === null) return false;
      return isSameDay(tdDate, date) && tdHour === hour;
    });
  };

  const getBookingsForModelDate = (date: Date, modelLabel: string) => {
    return filteredTestDrives.filter((td) => {
      if (!td.scheduled_date) return false;
      const bookingDate = parseISO(td.scheduled_date);
      const label = `${td?.vehicles?.brand || ''} ${td?.vehicles?.model || ''}`.trim();
      return isSameDay(bookingDate, date) && label === modelLabel;
    });
  };

  const getBookingsForTimeSlot = (date: Date, startTime: string) => {
    return filteredTestDrives.filter((td) => {
      if (!td.scheduled_date || !td.scheduled_time) return false;
      const bookingDate = parseISO(td.scheduled_date);
      const bookingStart = td.scheduled_time.substring(0, 5);

      return isSameDay(bookingDate, date) && bookingStart === startTime;
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
          <Link
            to={buildBookingLinkWithoutModel(date, slotTime)}
            className="block rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            Select model to book this time slot
          </Link>
        )}
        {slotBookings.map(renderBookingCard)}
      </div>
    );
  };

  const navigate = (dir: number) => {
    setCurrentDate(prev => addDays(prev, viewMode === 'week' ? dir * 7 : dir));
  };

  const handleDatePlannerClick = (date: Date, slotTime: string) => {
    if (selectedModelGroup === 'all') return;
    if (isPastSlot(date, slotTime)) return;
    if (!isSlotAvailableForSelectedModel(date, slotTime)) return;
    navigateTo(buildBookingLink(selectedModelGroup, date, slotTime));
  };

  const renderBookingCard = (td: any) => {
    const source = (td.source || '').toLowerCase();
    const canAssignByStatus = ASSIGNABLE_STATUSES.has(td.status);
    const canAssignBySource = source === 'online' || source === 'walkin';
    const canAssign = td.status !== 'completed' && td.status !== 'cancelled' && (canAssignByStatus || canAssignBySource);

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
      <div className="flex items-center justify-between mt-1">
        {td.profiles?.full_name ? (
          <span className="text-[10px] font-medium bg-background/50 px-1.5 py-0.5 rounded">{td.profiles.full_name}</span>
        ) : (
          <span className="text-[10px] italic opacity-60">Unassigned</span>
        )}
        {canAssign && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={(event) => {
              event.stopPropagation();
              setAssignDialog({ open: true, testDriveId: td.id });
              setSelectedSalesPerson(td.assigned_sales_person_id || '');
            }}
          >
            {td.profiles?.full_name ? <RefreshCw className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
          </Button>
        )}
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

              <Link to={bookingLink}>
                <Button className="w-full md:w-auto">
                  Book Appointment
                </Button>
              </Link>
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
                              <Link to={buildBookingLink(model, date)} className="block rounded-xl border border-dashed border-primary/25 bg-primary/5 p-3 hover:bg-primary/10 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-semibold text-primary">Book This Model</p>
                                    <p className="text-[11px] text-muted-foreground">Date preselected for quick appointment booking</p>
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
                              </Link>
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
    </div>
  );
};

export default GROCalendarView;
