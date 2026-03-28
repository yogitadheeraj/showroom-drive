import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { Plus, MapPin, Pencil, Clock, Phone, Mail, Smartphone, Monitor, Trash2, ChevronRight, Users, Calendar, AlertCircle, Lock, CalendarX } from 'lucide-react';
import { logStaffActivity } from '@/lib/activityLogger';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LocationsPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', phone: '', email: '' });
  const [hoursDialog, setHoursDialog] = useState<string | null>(null);
  const [hours, setHours] = useState<any[]>([]);
  const [savingHours, setSavingHours] = useState(false);
    const [slotDurationDialog, setSlotDurationDialog] = useState<string | null>(null);
    const [slotDuration, setSlotDuration] = useState<number>(30);
    const [slotDurations, setSlotDurations] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { role, profile } = useAuth();
  
  // Device management states
  const [deviceDialog, setDeviceDialog] = useState<string | null>(null);
  const [devices, setDevices] = useState<Record<string, any[]>>({});
  const [newDevice, setNewDevice] = useState({ name: '', device_type: 'tablet', serial_number: '', notes: '' });
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [testDriveCounts, setTestDriveCounts] = useState<Record<string, number>>({});
  const [testDriveTodayCounts, setTestDriveTodayCounts] = useState<Record<string, number>>({});
  const [testDriveNext7DaysCounts, setTestDriveNext7DaysCounts] = useState<Record<string, number>>({});
  const [todayHoursByLocation, setTodayHoursByLocation] = useState<Record<string, string>>({});
  const [dealerNamesById, setDealerNamesById] = useState<Record<string, string>>({});
  const [dealerBrandsByDealerId, setDealerBrandsByDealerId] = useState<Record<string, string[]>>({});
  
  // Test drive schedule states
  const [scheduleDialog, setScheduleDialog] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Record<string, any[]>>({});
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState<any>(null);

  // Special periods (breaks/holidays) states
  const [todayHoursRawByLocation, setTodayHoursRawByLocation] = useState<Record<string, any>>({});
  const [specialPeriodsByLocation, setSpecialPeriodsByLocation] = useState<Record<string, any[]>>({});
  const [specialPeriodsDialog, setSpecialPeriodsDialog] = useState<string | null>(null);
  const [specialPeriods, setSpecialPeriods] = useState<any[]>([]);
  const [editingSpecialPeriodId, setEditingSpecialPeriodId] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState({ name: '', start_date: '', end_date: '', is_full_closure: true, modified_open_time: '09:00', modified_close_time: '19:00', notes: '' });
  const [savingPeriod, setSavingPeriod] = useState(false);

  const hasInvalidModifiedHours = !newPeriod.is_full_closure && newPeriod.modified_close_time <= newPeriod.modified_open_time;

  const resetSpecialPeriodForm = () => {
    setEditingSpecialPeriodId(null);
    setNewPeriod({ name: '', start_date: '', end_date: '', is_full_closure: true, modified_open_time: '09:00', modified_close_time: '19:00', notes: '' });
  };

  // Check if user can manage schedules / breaks
  const canManageSchedules = [APP_ROLE.GRO, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN].includes(role as any);

  useEffect(() => {
    if (!dealerLoading) fetchLocations();
  }, [dealerId, dealerLoading]);

  const fetchLocations = async () => {
    let query = supabase.from('locations').select('*').order('name');
    if (dealerId) query = query.eq('dealer_id', dealerId);
    const { data } = await query;
    setLocations(data || []);

    if (data) {
      const durations: Record<string, number> = {};
      data.forEach(loc => {
        durations[loc.id] = Number(loc.slot_duration_minutes || 30);
      });
      setSlotDurations(durations);
    }
    const locationIds = (data || []).map((loc) => loc.id);
    const dealerIds = Array.from(new Set((data || []).map((loc) => loc.dealer_id).filter(Boolean)));
    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayStr = today.toISOString().split('T')[0];

    if (dealerIds.length > 0 || locationIds.length > 0) {
      const [{ data: dealersData }, { data: brandsData }, { data: todayHoursData }, { data: activePeriods }] = await Promise.all([
        dealerIds.length > 0
          ? supabase.from('dealers').select('id, name').in('id', dealerIds)
          : Promise.resolve({ data: [] as any[] }),
        dealerIds.length > 0
          ? supabase.from('brands').select('dealer_id, name').in('dealer_id', dealerIds).order('name')
          : Promise.resolve({ data: [] as any[] }),
        locationIds.length > 0
          ? supabase.from('location_operating_hours').select('location_id, open_time, close_time, is_closed').in('location_id', locationIds).eq('day_of_week', dayOfWeek)
          : Promise.resolve({ data: [] as any[] }),
        locationIds.length > 0
          ? supabase.from('location_special_periods').select('*').in('location_id', locationIds).lte('start_date', todayStr).gte('end_date', todayStr)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const dealerNameMap = (dealersData || []).reduce((acc: Record<string, string>, dealer: any) => {
        acc[dealer.id] = dealer.name;
        return acc;
      }, {});

      const dealerBrandsMap = (brandsData || []).reduce((acc: Record<string, string[]>, brand: any) => {
        if (!acc[brand.dealer_id]) acc[brand.dealer_id] = [];
        acc[brand.dealer_id].push(brand.name);
        return acc;
      }, {});

      const todayHoursMap = (todayHoursData || []).reduce((acc: Record<string, string>, row: any) => {
        acc[row.location_id] = row.is_closed
          ? 'Closed Today'
          : `${row.open_time?.substring(0, 5)} - ${row.close_time?.substring(0, 5)}`;
        return acc;
      }, {});

      const todayHoursRawMap = (todayHoursData || []).reduce((acc: Record<string, any>, row: any) => {
        acc[row.location_id] = row;
        return acc;
      }, {});

      const specialPeriodsMap = (activePeriods || []).reduce((acc: Record<string, any[]>, row: any) => {
        if (!acc[row.location_id]) acc[row.location_id] = [];
        acc[row.location_id].push(row);
        return acc;
      }, {});

      setDealerNamesById(dealerNameMap);
      setDealerBrandsByDealerId(dealerBrandsMap);
      setTodayHoursByLocation(todayHoursMap);
      setTodayHoursRawByLocation(todayHoursRawMap);
      setSpecialPeriodsByLocation(specialPeriodsMap);
    } else {
      setDealerNamesById({});
      setDealerBrandsByDealerId({});
      setTodayHoursByLocation({});
      setTodayHoursRawByLocation({});
      setSpecialPeriodsByLocation({});
    }
    
    // Fetch related data for each location
    if (data) {
      data.forEach(loc => {
        fetchDevices(loc.id);
        fetchStaffCount(loc.id);
        fetchTestDriveCount(loc.id);
      });
    }
  };

  const fetchDevices = async (locationId: string) => {
    const { data } = await supabase.from('location_devices').select('*').eq('location_id', locationId).order('created_at', { ascending: false });
    setDevices(prev => ({ ...prev, [locationId]: data || [] }));
  };

  const fetchStaffCount = async (locationId: string) => {
    try {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('location_id', locationId);
      setStaffCounts(prev => ({ ...prev, [locationId]: count || 0 }));
    } catch (err) {
      console.error('Error fetching staff count:', err);
      setStaffCounts(prev => ({ ...prev, [locationId]: 0 }));
    }
  };

  const fetchTestDriveCount = async (locationId: string) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const next7 = new Date(today);
      next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split('T')[0];

      const [{ count }, { count: todayCount }, { count: next7Count }] = await Promise.all([
        supabase.from('test_drives').select('id', { count: 'exact', head: true }).eq('location_id', locationId).in('status', ['confirmed', 'show', 'in_progress', 'scheduled']),
        supabase.from('test_drives').select('id', { count: 'exact', head: true }).eq('location_id', locationId).eq('scheduled_date', todayStr).in('status', ['confirmed', 'show', 'in_progress', 'scheduled']),
        supabase.from('test_drives').select('id', { count: 'exact', head: true }).eq('location_id', locationId).gte('scheduled_date', todayStr).lte('scheduled_date', next7Str).in('status', ['confirmed', 'show', 'in_progress', 'scheduled']),
      ]);

      setTestDriveCounts(prev => ({ ...prev, [locationId]: count || 0 }));
      setTestDriveTodayCounts(prev => ({ ...prev, [locationId]: todayCount || 0 }));
      setTestDriveNext7DaysCounts(prev => ({ ...prev, [locationId]: next7Count || 0 }));
    } catch (err) {
      console.error('Error fetching test drive count:', err);
      setTestDriveCounts(prev => ({ ...prev, [locationId]: 0 }));
      setTestDriveTodayCounts(prev => ({ ...prev, [locationId]: 0 }));
      setTestDriveNext7DaysCounts(prev => ({ ...prev, [locationId]: 0 }));
    }
  };

  const fetchSchedules = async (locationId: string) => {
    const { data } = await supabase.from('test_drives').select('id, scheduled_date, scheduled_time, status').eq('location_id', locationId).gte('scheduled_date', new Date().toISOString().split('T')[0]).order('scheduled_date').order('scheduled_time');
    setSchedules(prev => ({ ...prev, [locationId]: data || [] }));
  };

  const openScheduleDialog = (locationId: string) => {
    fetchSchedules(locationId);
    setScheduleDialog(locationId);
  };

  const openSlotDurationDialog = (locationId: string) => {
    setSlotDuration(slotDurations[locationId] || 30);
    setSlotDurationDialog(locationId);
  };

  const saveSlotDuration = async () => {
    if (!slotDurationDialog) return;
    try {
      await supabase
        .from('locations')
        .update({ slot_duration_minutes: slotDuration })
        .eq('id', slotDurationDialog);
      setSlotDurations((prev) => ({ ...prev, [slotDurationDialog]: slotDuration }));
      toast({ title: 'Slot duration saved successfully', description: `${slotDuration} minutes per slot` });
      setSlotDurationDialog(null);
    } catch (err: any) {
      toast({ title: 'Failed to save slot duration', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address || !formData.city) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    const payload = { ...formData, dealer_id: dealerId };
    if (editingId) {
      await supabase.from('locations').update(formData).eq('id', editingId);
      toast({ title: 'Location updated' });
    } else {
      await supabase.from('locations').insert(payload);
      toast({ title: 'Location added' });
    }
    setShowDialog(false);
    setEditingId(null);
    setFormData({ name: '', address: '', city: '', state: '', phone: '', email: '' });
    fetchLocations();
  };

  const editLocation = (loc: any) => {
    setEditingId(loc.id);
    setFormData({ name: loc.name, address: loc.address, city: loc.city, state: loc.state || '', phone: loc.phone || '', email: loc.email || '' });
    setShowDialog(true);
  };

  const openHoursDialog = async (locationId: string) => {
    const { data } = await supabase.from('location_operating_hours').select('*').eq('location_id', locationId).order('day_of_week');
    const fullHours = DAYS.map((_, i) => {
      const existing = data?.find(d => d.day_of_week === i);
      return existing || { location_id: locationId, day_of_week: i, open_time: '09:00', close_time: '19:00', is_closed: false, id: null };
    });
    setHours(fullHours);
    setHoursDialog(locationId);
  };

  const updateHourField = (dayIndex: number, field: string, value: any) => {
    setHours(prev => prev.map((h, i) => i === dayIndex ? { ...h, [field]: value } : h));
  };

  const saveHours = async () => {
    if (!hoursDialog) return;
    setSavingHours(true);
    try {
      for (const h of hours) {
        const row = { location_id: hoursDialog, day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time, is_closed: h.is_closed };
        if (h.id) {
          await supabase.from('location_operating_hours').update(row).eq('id', h.id);
        } else {
          await supabase.from('location_operating_hours').insert(row);
        }
      }
      toast({ title: 'Operating hours saved' });
      if (profile?.user_id) {
        await logStaffActivity({
          userId: profile.user_id,
          profileId: profile.id,
          locationId: hoursDialog,
          role,
          eventType: 'location_hours_updated',
          label: 'Updated location operating hours',
          metadata: { locationId: hoursDialog },
        });
      }
      setHoursDialog(null);
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally { setSavingHours(false); }
  };

  const openDeviceDialog = (locationId: string) => {
    setDeviceDialog(locationId);
    setNewDevice({ name: '', device_type: 'tablet', serial_number: '', notes: '' });
  };

  const addDevice = async () => {
    if (!deviceDialog || !newDevice.name) {
      toast({ title: 'Device name is required', variant: 'destructive' });
      return;
    }
    
    try {
      await supabase.from('location_devices').insert({
        location_id: deviceDialog,
        name: newDevice.name,
        device_type: newDevice.device_type,
        serial_number: newDevice.serial_number || null,
        notes: newDevice.notes || null,
        is_active: true
      });
      
      toast({ title: 'Device added successfully' });
      if (profile?.user_id) {
        await logStaffActivity({
          userId: profile.user_id,
          profileId: profile.id,
          locationId: deviceDialog,
          role,
          eventType: 'location_device_added',
          label: 'Added location device',
          metadata: { locationId: deviceDialog, deviceName: newDevice.name, deviceType: newDevice.device_type },
        });
      }
      fetchDevices(deviceDialog);
      setDeviceDialog(null);
      setNewDevice({ name: '', device_type: 'tablet', serial_number: '', notes: '' });
    } catch (err: any) {
      toast({ title: 'Failed to add device', description: err.message, variant: 'destructive' });
    }
  };

  const deleteDevice = async (locationId: string, deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    try {
      await supabase.from('location_devices').delete().eq('id', deviceId);
      toast({ title: 'Device deleted' });
      if (profile?.user_id) {
        await logStaffActivity({
          userId: profile.user_id,
          profileId: profile.id,
          locationId,
          role,
          eventType: 'location_device_deleted',
          label: 'Deleted location device',
          metadata: { locationId, deviceId },
        });
      }
      fetchDevices(locationId);
    } catch (err: any) {
      toast({ title: 'Failed to delete device', description: err.message, variant: 'destructive' });
    }
  };

  const toggleDevice = async (locationId: string, deviceId: string, isActive: boolean) => {
    try {
      await supabase.from('location_devices').update({ is_active: !isActive }).eq('id', deviceId);
      fetchDevices(locationId);
    } catch (err: any) {
      toast({ title: 'Failed to update device', variant: 'destructive' });
    }
  };

  const getLocationStatus = (locationId: string): { open: boolean; label: string; subLabel?: string } => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const activePeriod = (specialPeriodsByLocation[locationId] || []).find(
      (p: any) => p.start_date <= todayStr && p.end_date >= todayStr
    );

    if (activePeriod) {
      if (activePeriod.is_full_closure) {
        return { open: false, label: 'Closed', subLabel: activePeriod.name };
      }
      if (activePeriod.modified_open_time && activePeriod.modified_close_time) {
        const open = currentTime >= activePeriod.modified_open_time.substring(0, 5)
                  && currentTime <= activePeriod.modified_close_time.substring(0, 5);
        return {
          open,
          label: open ? 'Open Now' : 'Closed',
          subLabel: `${activePeriod.name} · ${activePeriod.modified_open_time.substring(0, 5)}–${activePeriod.modified_close_time.substring(0, 5)}`,
        };
      }
    }

    const raw = todayHoursRawByLocation[locationId];
    if (!raw) return { open: false, label: 'Hours Not Set' };
    if (raw.is_closed) return { open: false, label: 'Closed Today' };

    const isOpen = currentTime >= raw.open_time.substring(0, 5) && currentTime <= raw.close_time.substring(0, 5);
    return {
      open: isOpen,
      label: isOpen ? 'Open Now' : 'Closed',
      subLabel: isOpen
        ? `Until ${raw.close_time.substring(0, 5)}`
        : currentTime < raw.open_time.substring(0, 5)
          ? `Opens ${raw.open_time.substring(0, 5)}`
          : `${raw.open_time.substring(0, 5)}–${raw.close_time.substring(0, 5)}`,
    };
  };

  const openSpecialPeriodsDialog = async (locationId: string) => {
    const { data, error } = await supabase
      .from('location_special_periods')
      .select('*')
      .eq('location_id', locationId)
      .order('start_date', { ascending: false });

    if (error) {
      toast({ title: 'Failed to load saved records', description: error.message, variant: 'destructive' });
      setSpecialPeriods([]);
    } else {
      setSpecialPeriods(data || []);
    }

    resetSpecialPeriodForm();
    setSpecialPeriodsDialog(locationId);
  };

  const startEditSpecialPeriod = (period: any) => {
    setEditingSpecialPeriodId(period.id);
    setNewPeriod({
      name: period.name || '',
      start_date: period.start_date || '',
      end_date: period.end_date || '',
      is_full_closure: !!period.is_full_closure,
      modified_open_time: period.modified_open_time?.substring(0, 5) || '09:00',
      modified_close_time: period.modified_close_time?.substring(0, 5) || '19:00',
      notes: period.notes || '',
    });
  };

  const addSpecialPeriod = async () => {
    if (!specialPeriodsDialog || !newPeriod.name || !newPeriod.start_date || !newPeriod.end_date) {
      toast({ title: 'Name, start date, and end date are required', variant: 'destructive' });
      return;
    }
    if (newPeriod.end_date < newPeriod.start_date) {
      toast({ title: 'End date must be on or after start date', variant: 'destructive' });
      return;
    }
    if (hasInvalidModifiedHours) {
      toast({ title: 'Close time must be after open time', variant: 'destructive' });
      return;
    }
    setSavingPeriod(true);
    try {
      const payload = {
        name: newPeriod.name,
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        is_full_closure: newPeriod.is_full_closure,
        modified_open_time: newPeriod.is_full_closure ? null : newPeriod.modified_open_time,
        modified_close_time: newPeriod.is_full_closure ? null : newPeriod.modified_close_time,
        notes: newPeriod.notes || null,
      };

      const { error: saveError } = editingSpecialPeriodId
        ? await supabase.from('location_special_periods').update(payload).eq('id', editingSpecialPeriodId)
        : await supabase.from('location_special_periods').insert({
            location_id: specialPeriodsDialog,
            ...payload,
          });

      if (saveError) throw saveError;

      toast({ title: editingSpecialPeriodId ? 'Special period updated' : 'Special period added' });
      resetSpecialPeriodForm();

      const { data: refreshed, error: refreshError } = await supabase
        .from('location_special_periods')
        .select('*')
        .eq('location_id', specialPeriodsDialog)
        .order('start_date', { ascending: false });

      if (refreshError) throw refreshError;

      setSpecialPeriods(refreshed || []);
      fetchLocations();
    } catch (err: any) {
      toast({ title: 'Failed to add period', description: err.message, variant: 'destructive' });
    } finally { setSavingPeriod(false); }
  };

  const deleteSpecialPeriod = async (periodId: string) => {
    if (!confirm('Delete this special period?')) return;
    try {
      const { error: deleteError } = await supabase.from('location_special_periods').delete().eq('id', periodId);
      if (deleteError) throw deleteError;

      toast({ title: 'Period removed' });

      if (specialPeriodsDialog) {
        const { data: refreshed, error: refreshError } = await supabase
          .from('location_special_periods')
          .select('*')
          .eq('location_id', specialPeriodsDialog)
          .order('start_date', { ascending: false });

        if (refreshError) throw refreshError;

        setSpecialPeriods(refreshed || []);
        fetchLocations();
      }
    } catch (err: any) {
      toast({ title: 'Failed to delete period', description: err.message, variant: 'destructive' });
    }
  };

  const hoursLocationName = locations.find(l => l.id === hoursDialog)?.name || '';

  if (dealerLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">Locations</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your dealership locations and devices</p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormData({ name: '', address: '', city: '', state: '', phone: '', email: '' }); setShowDialog(true); }}
            className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </div>

        {locations.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 sm:p-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No locations yet. Create your first location to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {locations.map(loc => (
              <Card key={loc.id} className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden border-border/50">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent border-b border-border/50 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0 shadow-sm">
                        <MapPin className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-heading font-bold text-foreground leading-tight">{loc.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{loc.address}</p>
                        <p className="text-xs text-muted-foreground">{loc.city}{loc.state ? `, ${loc.state}` : ''}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 h-9 w-9 p-0" onClick={() => editLocation(loc)} title="Edit Location">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Status & Info Badges */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(() => {
                      const s = getLocationStatus(loc.id);
                      return (
                        <Badge className={`text-xs font-semibold border ${s.open ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                          <span className="mr-1.5">{s.open ? '●' : '●'}</span>
                          {s.label}
                        </Badge>
                      );
                    })()}
                    <Badge variant="outline" className="text-xs font-medium">
                      {dealerNamesById[loc.dealer_id] || 'Unknown'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs max-w-xs truncate font-medium">
                      {(dealerBrandsByDealerId[loc.dealer_id] || []).length > 0
                        ? dealerBrandsByDealerId[loc.dealer_id].slice(0, 2).join(', ') + ((dealerBrandsByDealerId[loc.dealer_id] || []).length > 2 ? '...' : '')
                        : 'No brands'}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5 sm:p-6 space-y-5">
                  {/* KPI Grid */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance Metrics</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { label: 'Total Drives', value: testDriveCounts[loc.id] || 0, color: 'primary', icon: '📊' },
                        { label: 'Today', value: testDriveTodayCounts[loc.id] || 0, color: 'primary', icon: '📅' },
                        { label: 'Next 7 Days', value: testDriveNext7DaysCounts[loc.id] || 0, color: 'info', icon: '📈' },
                        { label: 'Staff', value: staffCounts[loc.id] || 0, color: 'success', icon: '👥' },
                        { label: 'Devices', value: (devices[loc.id] || []).filter(d => d.is_active).length, color: 'info', icon: '📱' },
                        { label: 'Hours', value: todayHoursByLocation[loc.id] || '—', color: 'muted', icon: '🕐' },
                      ].map((stat, idx) => (
                        <div key={idx} className={`rounded-lg border border-border/50 bg-gradient-to-br from-${stat.color}/5 to-transparent p-3 text-center hover:border-${stat.color}/30 transition-colors`}>
                          <div className="text-2xl mb-1">{stat.icon}</div>
                          <div className={`text-xs font-semibold text-${stat.color} mb-1`}>{typeof stat.value === 'number' ? stat.value : stat.value}</div>
                          <div className="text-xs text-muted-foreground leading-tight">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact Section */}
                  <div className="border-t border-border/50 pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
                    <div className="space-y-2">
                      {loc.phone && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-info/8 to-transparent border border-info/20 hover:border-info/40 transition-colors">
                          <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                            <Phone className="h-5 w-5 text-info" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-muted-foreground">Phone</p>
                            <p className="text-sm font-semibold text-foreground">{loc.phone}</p>
                          </div>
                        </div>
                      )}
                      {loc.email && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-info/8 to-transparent border border-info/20 hover:border-info/40 transition-colors">
                          <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                            <Mail className="h-5 w-5 text-info" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-muted-foreground">Email</p>
                            <p className="text-sm font-semibold text-foreground truncate">{loc.email}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-info/8 to-transparent border border-info/20 hover:border-info/40 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                          <Clock className="h-5 w-5 text-info" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-muted-foreground">Today</p>
                          <p className="text-sm font-semibold text-foreground">{todayHoursByLocation[loc.id] || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Devices Section */}
                  {devices[loc.id]?.length > 0 && (
                    <div className="border-t border-border/50 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Smartphone className="h-3.5 w-3.5" /> Devices ({devices[loc.id].filter(d => d.is_active).length} active)
                        </h4>
                        <Button size="sm" className="h-7 px-2 bg-info text-info-foreground hover:bg-info/90 text-xs" onClick={() => openDeviceDialog(loc.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {devices[loc.id].slice(0, 3).map(dev => (
                          <div key={dev.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">{dev.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{dev.device_type}{dev.serial_number ? ` • ${dev.serial_number}` : ''}</p>
                              </div>
                            </div>
                            <Badge variant={dev.is_active ? 'default' : 'secondary'} className="text-xs shrink-0 ml-2">
                              {dev.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        ))}
                        {devices[loc.id].length > 3 && (
                          <p className="text-xs text-muted-foreground italic text-center py-1">+{devices[loc.id].length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="border-t border-border/50 pt-4">
                    {canManageSchedules ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-xs h-9 font-medium" onClick={() => openHoursDialog(loc.id)}>
                            <Clock className="h-3.5 w-3.5 mr-1.5" /> Hours
                          </Button>
                          <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600 text-xs h-9 font-medium" onClick={() => openSpecialPeriodsDialog(loc.id)}>
                            <CalendarX className="h-3.5 w-3.5 mr-1.5" /> Breaks
                          </Button>
                          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 font-medium" onClick={() => openScheduleDialog(loc.id)}>
                            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Schedule
                          </Button>
                        </div>
                        <Button size="sm" className="w-full mt-2 bg-violet-500 text-white hover:bg-violet-600 text-xs h-9 font-medium" onClick={() => openSlotDurationDialog(loc.id)}>
                          <Clock className="h-3.5 w-3.5 mr-1.5" /> Slot Duration: {slotDurations[loc.id] || 30}m
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Admin only</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit' : 'Add'} Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address *</Label><Input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2"><Label>City *</Label><Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <Button onClick={handleSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{editingId ? 'Update' : 'Add'} Location</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Operating Hours Dialog */}
        <Dialog open={!!hoursDialog} onOpenChange={() => setHoursDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Hours — {hoursLocationName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 sm:space-y-3 p-10">
              {hours.map((h, i) => (
                <div key={i} className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors ${h.is_closed ? 'bg-muted/50 border-border' : 'bg-card border-border'}`}>
                  <div className="w-full sm:w-24 flex items-center justify-between sm:block">
                    <span className={`text-sm font-medium ${h.is_closed ? 'text-muted-foreground' : 'text-foreground'}`}>{DAYS[i]}</span>
                    <div className="flex items-center gap-2 sm:hidden">
                      <Switch checked={!h.is_closed} onCheckedChange={(v) => updateHourField(i, 'is_closed', !v)} />
                      <span className="text-xs text-muted-foreground">{h.is_closed ? 'Closed' : 'Open'}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Switch checked={!h.is_closed} onCheckedChange={(v) => updateHourField(i, 'is_closed', !v)} />
                    <span className="text-xs text-muted-foreground w-10">{h.is_closed ? 'Closed' : 'Open'}</span>
                  </div>
                  {!h.is_closed && (
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                      <Input type="time" value={h.open_time?.substring(0, 5) || '09:00'}
                        onChange={e => updateHourField(i, 'open_time', e.target.value)}
                        className="flex-1 sm:w-28 h-8 text-xs" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" value={h.close_time?.substring(0, 5) || '19:00'}
                        onChange={e => updateHourField(i, 'close_time', e.target.value)}
                        className="flex-1 sm:w-28 h-8 text-xs" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={saveHours} disabled={savingHours} className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {savingHours ? 'Saving...' : 'Save Hours'}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Add Device Dialog */}
        <Dialog open={!!deviceDialog} onOpenChange={() => setDeviceDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Device</DialogTitle>
              <DialogDescription>Register a new device for this location</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Device Name *</Label>
                <Input 
                  placeholder="e.g., Tablet 1, Check-in Kiosk" 
                  value={newDevice.name}
                  onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Device Type</Label>
                <select 
                  className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm bg-background"
                  value={newDevice.device_type}
                  onChange={e => setNewDevice(p => ({ ...p, device_type: e.target.value }))}
                >
                  <option value="tablet">Tablet</option>
                  <option value="laptop">Laptop</option>
                  <option value="desktop">Desktop</option>
                  <option value="kiosk">Kiosk</option>
                  <option value="printer">Printer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input 
                  placeholder="Device serial or asset number" 
                  value={newDevice.serial_number}
                  onChange={e => setNewDevice(p => ({ ...p, serial_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Any additional notes..."
                  value={newDevice.notes}
                  onChange={e => setNewDevice(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeviceDialog(null)}>Cancel</Button>
              <Button onClick={addDevice} className="bg-primary text-primary-foreground hover:bg-primary/90">Add Device</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Special Periods (Breaks / Holidays) Dialog */}
        <Dialog open={!!specialPeriodsDialog} onOpenChange={() => {
          setSpecialPeriodsDialog(null);
          resetSpecialPeriodForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <CalendarX className="h-5 w-5 text-orange-500" />
                Breaks & Closures — {locations.find(l => l.id === specialPeriodsDialog)?.name}
              </DialogTitle>
              <DialogDescription>
                Manage Ramadan breaks, holidays, and any special periods that override regular hours.
              </DialogDescription>
              <p className="text-xs text-muted-foreground">
                Saved records: <span className="font-medium text-foreground">{specialPeriods.length}</span>
              </p>
            </DialogHeader>

            {/* Add / Edit Period */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> {editingSpecialPeriodId ? 'Edit Period' : 'Add New Period'}
              </h4>
              <div className="space-y-2">
                <Label>Period Name *</Label>
                <Input
                  placeholder="e.g. Ramadan 2026, Eid Holiday, National Day"
                  value={newPeriod.name}
                  onChange={e => setNewPeriod(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={newPeriod.start_date} onChange={e => setNewPeriod(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input type="date" value={newPeriod.end_date} onChange={e => setNewPeriod(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-3 py-1">
                <Switch
                  checked={newPeriod.is_full_closure}
                  onCheckedChange={v => setNewPeriod(p => ({ ...p, is_full_closure: v }))}
                />
                <div>
                  <Label className="cursor-pointer font-medium">
                    {newPeriod.is_full_closure ? 'Full Closure (Closed all day)' : 'Modified Hours'}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {newPeriod.is_full_closure
                      ? 'Location will show as Closed during this period'
                      : 'Location opens with different hours during this period'}
                  </p>
                </div>
              </div>
              {!newPeriod.is_full_closure && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs">Modified Open Time</Label>
                      <Input type="time" value={newPeriod.modified_open_time}
                        onChange={e => setNewPeriod(p => ({ ...p, modified_open_time: e.target.value }))}
                        className="h-8 text-xs" />
                    </div>
                    <span className="text-xs text-muted-foreground mt-5">to</span>
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs">Modified Close Time</Label>
                      <Input type="time" value={newPeriod.modified_close_time}
                        onChange={e => setNewPeriod(p => ({ ...p, modified_close_time: e.target.value }))}
                        className="h-8 text-xs" />
                    </div>
                  </div>
                  {hasInvalidModifiedHours && (
                    <p className="text-xs text-destructive">Close time must be after open time.</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Any additional notes for staff..."
                  value={newPeriod.notes}
                  onChange={e => setNewPeriod(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
              </div>
              <Button onClick={addSpecialPeriod} disabled={savingPeriod || hasInvalidModifiedHours}
                className="w-full bg-orange-500 text-white hover:bg-orange-600">
                {savingPeriod ? 'Saving...' : editingSpecialPeriodId ? 'Update Period' : 'Add Period'}
              </Button>
              {editingSpecialPeriodId && (
                <Button type="button" variant="outline" className="w-full" onClick={resetSpecialPeriodForm}>
                  Cancel Edit
                </Button>
              )}
            </div>

            {/* Existing Periods List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Periods</h4>
              {specialPeriods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarX className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No special periods set for this location.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {specialPeriods.map((period: any) => {
                    const today = new Date().toISOString().split('T')[0];
                    const isActive = period.start_date <= today && period.end_date >= today;
                    const isPast = period.end_date < today;
                    return (
                      <div key={period.id} className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${isActive ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20' : isPast ? 'border-border bg-muted/30 opacity-60' : 'border-border bg-card'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{period.name}</span>
                            {isActive && <Badge className="text-[10px] bg-orange-500 text-white px-1.5">Active</Badge>}
                            {isPast && <Badge variant="secondary" className="text-[10px]">Past</Badge>}
                            <Badge variant={period.is_full_closure ? 'destructive' : 'outline'} className="text-[10px]">
                              {period.is_full_closure ? 'Full Closure' : 'Modified Hours'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {period.start_date} → {period.end_date}
                            {!period.is_full_closure && period.modified_open_time &&
                              ` · ${period.modified_open_time?.substring(0, 5)}–${period.modified_close_time?.substring(0, 5)}`}
                          </p>
                          {period.notes && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{period.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-primary/15"
                            onClick={() => startEditSpecialPeriod(period)}
                            title="Edit period"
                          >
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-destructive/20"
                            onClick={() => deleteSpecialPeriod(period.id)}
                            title="Delete period">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSpecialPeriodsDialog(null);
                resetSpecialPeriodForm();
              }}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Drive Schedule Dialog */}
        <Dialog open={!!scheduleDialog} onOpenChange={() => setScheduleDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Test Drive Schedule — {locations.find(l => l.id === scheduleDialog)?.name}
              </DialogTitle>
              <DialogDescription>View upcoming test drives at this location</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2">
              {schedules[scheduleDialog]?.length ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {schedules[scheduleDialog].map((drive: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{drive.scheduled_date}</p>
                        <p className="text-xs text-muted-foreground">{drive.scheduled_time}</p>
                      </div>
                      <Badge variant={
                        drive.status === 'completed' ? 'secondary' :
                        drive.status === 'in_progress' ? 'default' :
                        drive.status === 'confirmed' ? 'outline' : 'secondary'
                      } className="text-xs">
                        {drive.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground text-sm">No upcoming test drives scheduled</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button onClick={() => setScheduleDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Slot Duration Configuration Dialog */}
        <Dialog open={!!slotDurationDialog} onOpenChange={() => setSlotDurationDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Clock className="h-5 w-5 text-violet-500" />
                Slot Duration
              </DialogTitle>
              <DialogDescription>
                Set the duration for each test drive slot at {locations.find(l => l.id === slotDurationDialog)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Select Slot Duration</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[15, 30, 45, 60, 90, 120].map(duration => (
                    <button
                      key={duration}
                      onClick={() => setSlotDuration(duration)}
                      className={`p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${
                        slotDuration === duration
                          ? 'border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100'
                          : 'border-border bg-card hover:border-violet-300'
                      }`}
                    >
                      {duration}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-blue/10 border border-blue/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Selected:</span> {slotDuration} minutes per slot
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Each booking will reserve a {slotDuration}-minute slot. Previous bookings affecting this slot must be completed or marked as no-show.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSlotDurationDialog(null)}>Cancel</Button>
              <Button onClick={saveSlotDuration} className="bg-violet-500 text-white hover:bg-violet-600">
                Save Duration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LocationsPage;
