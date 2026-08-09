import { useEffect, useState } from 'react';
import { apiDbQuery } from '@/lib/apiClient';
import { createLocation, updateLocation } from '@/lib/locationBrandService';
import { bulkUpsertLocationOperatingHours, listLocationOperatingHours } from '@/lib/locationOperatingHoursService';
import {
  createLocationSpecialPeriod,
  deleteLocationSpecialPeriod,
  listLocationSpecialPeriods,
  updateLocationSpecialPeriod,
} from '@/lib/locationSpecialPeriodsService';
import { listBusinessUnits, listSalesOffices, listPlants, type BusinessUnit, type SalesOffice, type Plant } from '@/lib/hierarchyService';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { Plus, MapPin, Pencil, Clock, Phone, Mail, Smartphone, Monitor, Trash2, ChevronRight, Users, Calendar, AlertCircle, Lock, CalendarX, CalendarDays, Tag, Building2, Layers, Factory, Globe, ExternalLink, Info, Eye } from 'lucide-react';
import { logStaffActivity } from '@/lib/activityLogger';
import { cn } from '@/lib/utils';
import { COUNTRIES, validatePhoneForCountry, validateEmail } from '@/lib/countries';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isMissingSlotDurationColumnError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('slot_duration_minutes') && message.includes('schema cache');
};

const isMissingMetadataColumnError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('metadata') && message.includes('schema cache');
};

const getLocationSlotDuration = (location: any) => {
  const fromColumn = Number(location?.slot_duration_minutes);
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn;

  const fromMetadata = Number(location?.metadata?.slot_duration_minutes);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata;

  return 30;
};

const LocationsPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [detailLoc, setDetailLoc] = useState<any | null>(null);
  const [step, setStep] = useState(1);

  // Superadmin filter state
  const [allDealers, setAllDealers] = useState<{ id: string; name: string }[]>([]);
  const [filterDealerId, setFilterDealerId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('');
  const [filterBUId, setFilterBUId] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [allBrandsForFilter, setAllBrandsForFilter] = useState<{ id: string; name: string; dealer_id: string }[]>([]);

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', latitude: '', longitude: '', googleplaceid: '', maplink: '', currency_type: 'INR', businessUnitId: '', businessUnitName: '', salesOfficeId: '', salesOfficeName: '', plantId: '', plantName: '', brandId: '', brandName: '' });
  const [dealerBrands, setDealerBrands] = useState<{ id: string; name: string }[]>([]);
  const [locErrors, setLocErrors] = useState<Record<string, string>>({});

  // Hierarchy data for dropdowns
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [salesOffices, setSalesOffices] = useState<SalesOffice[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [hoursDialog, setHoursDialog] = useState<string | null>(null);
  const [hours, setHours] = useState<any[]>([]);
  const [savingHours, setSavingHours] = useState(false);
  const [slotDurationDialog, setSlotDurationDialog] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [slotDurations, setSlotDurations] = useState<Record<string, number>>({});
  const [advBookingDaysDialog, setAdvBookingDaysDialog] = useState<string | null>(null);
  const [advBookingDays, setAdvBookingDays] = useState<number>(30);
  const [advBookingDaysMap, setAdvBookingDaysMap] = useState<Record<string, number>>({});
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
  const canManageSchedules = [APP_ROLE.GRO, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN, APP_ROLE.BRAND_ADMIN, APP_ROLE.SALES_ADMIN].includes(role as any);

  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;

  useEffect(() => {
    if (!dealerLoading) {
      fetchLocations();
      if (isSuperAdmin) {
        // Load all data across all dealers for superadmin
        void Promise.all([
          apiDbQuery<any[]>({ table: 'dealers', action: 'select', select: 'id, name', order: [{ field: 'name', ascending: true }] })
            .then(d => setAllDealers((d ?? []).map((x: any) => ({ id: x.id, name: x.name })))),
          listBusinessUnits().then(d => setBusinessUnits(d ?? [])),
          listSalesOffices().then(d => setSalesOffices(d ?? [])),
          listPlants().then(d => setPlants(d ?? [])),
          apiDbQuery<any[]>({ table: 'brands', action: 'select', select: 'id, name, dealer_id', order: [{ field: 'name', ascending: true }] })
            .then(d => {
              const brands = d ?? [];
              setAllBrandsForFilter(brands.map((b: any) => ({ id: b.id, name: b.name, dealer_id: b.dealer_id })));
              setDealerBrands(brands.map((b: any) => ({ id: b.id, name: b.name })));
            }),
        ]);
      } else if (dealerId) {
        void Promise.all([
          listBusinessUnits(dealerId).then(d => setBusinessUnits(d ?? [])),
          listSalesOffices({ orgId: dealerId }).then(d => setSalesOffices(d ?? [])),
          listPlants({ orgId: dealerId }).then(d => setPlants(d ?? [])),
          apiDbQuery<any[]>({
            table: 'brands',
            action: 'select',
            select: 'id, name',
            filters: [{ field: 'dealer_id', op: 'eq', value: dealerId }],
            order: [{ field: 'name', ascending: true }],
          }).then(d => setDealerBrands((d ?? []).map((b: any) => ({ id: b.id, name: b.name })))),
        ]);
      }
    }
  }, [dealerId, dealerLoading]);

  // Re-fetch when superadmin changes filters
  useEffect(() => {
    if (!dealerLoading && isSuperAdmin) fetchLocations();
  }, [filterDealerId, filterBrandId, filterBUId, filterCity]);

  // Auto-select dropdowns when only one option is available
  useEffect(() => {
    if (!showDialog) return;
    if (dealerBrands.length === 1 && !formData.brandId) {
      const br = dealerBrands[0];
      setFormData(p => ({ ...p, brandId: br.id, brandName: br.name }));
    }
    if (businessUnits.length === 1 && !formData.businessUnitId) {
      const bu = businessUnits[0];
      setFormData(p => ({ ...p, businessUnitId: bu.id, businessUnitName: bu.name, salesOfficeId: '', salesOfficeName: '', plantId: '', plantName: '' }));
    }
  }, [showDialog, dealerBrands, businessUnits]);

  // Auto-select single Sales Office when BU is chosen
  useEffect(() => {
    if (!showDialog || !formData.businessUnitId) return;
    const soList = salesOffices.filter(so => so.businessUnitId === formData.businessUnitId);
    if (soList.length === 1 && !formData.salesOfficeId) {
      const so = soList[0];
      setFormData(p => ({ ...p, salesOfficeId: so.id, salesOfficeName: so.name, plantId: '', plantName: '' }));
    }
  }, [showDialog, formData.businessUnitId, salesOffices]);

  // Auto-select single Plant when SO is chosen
  useEffect(() => {
    if (!showDialog || !formData.salesOfficeId) return;
    const plList = plants.filter(pl => pl.salesOfficeId === formData.salesOfficeId);
    if (plList.length === 1 && !formData.plantId) {
      const pl = plList[0];
      setFormData(p => ({ ...p, plantId: pl.id, plantName: pl.name }));
    }
  }, [showDialog, formData.salesOfficeId, plants]);

  const fetchLocations = async () => {
    const filters: { field: string; op: 'eq' | 'ilike'; value: any }[] = [];
    if (dealerId) filters.push({ field: 'dealer_id', op: 'eq', value: dealerId });
    if (profile?.brand_ids && role!=='dealer_admin') filters.push({ field: 'brandId', op: 'eq', value: profile?.brand_ids?.join(',') });
    if (filterDealerId) filters.push({ field: 'dealer_id', op: 'eq', value: filterDealerId });
    if (filterBrandId) filters.push({ field: 'brandId', op: 'eq', value: filterBrandId });
    if (filterBUId) filters.push({ field: 'businessUnitId', op: 'eq', value: filterBUId });
    if (filterCity.trim()) filters.push({ field: 'city', op: 'ilike', value: `%${filterCity.trim()}%` });
    const data = await apiDbQuery<any[]>({
      table: 'locations',
      action: 'select',
      select: '*',
      filters: filters.length > 0 ? filters : undefined,
      order: [{ field: 'name', ascending: true }],
    });
    setLocations(data || []);

    if (data) {
      const durations: Record<string, number> = {};
      const advDays: Record<string, number> = {};
      data.forEach(loc => {
        durations[loc.id] = getLocationSlotDuration(loc);
        advDays[loc.id] = loc.advance_booking_days ?? 30;
      });
      setSlotDurations(durations);
      setAdvBookingDaysMap(advDays);
    }
    const locationIds = (data || []).map((loc) => loc.id);
    const dealerIds = Array.from(new Set((data || []).map((loc) => loc.dealer_id).filter(Boolean)));
    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayStr = today.toISOString().split('T')[0];

    if (dealerIds.length > 0 || locationIds.length > 0) {
      const [dealersData, brandsData, todayHoursData, activePeriods] = await Promise.all([
        dealerIds.length > 0
          ? apiDbQuery<any[]>({
              table: 'dealers',
              action: 'select',
              select: 'id, name',
              filters: [{ field: 'id', op: 'in', value: dealerIds }],
            })
          : Promise.resolve([] as any[]),
        dealerIds.length > 0
          ? apiDbQuery<any[]>({
              table: 'brands',
              action: 'select',
              select: 'dealer_id, name',
              filters: [{ field: 'dealer_id', op: 'in', value: dealerIds }],
              order: [{ field: 'name', ascending: true }],
            })
          : Promise.resolve([] as any[]),
        locationIds.length > 0
          ? listLocationOperatingHours({ locationIds, dayOfWeek })
          : Promise.resolve([] as any[]),
        locationIds.length > 0
          ? Promise.all(
              locationIds.map((locationId) =>
                listLocationSpecialPeriods({
                  location_id: locationId,
                  start_date: todayStr,
                  end_date: todayStr,
                })
              )
            ).then((parts) => parts.flat())
          : Promise.resolve([] as any[]),
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
    const data = await apiDbQuery<any[]>({
      table: 'location_devices',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: locationId }],
      order: [{ field: 'created_at', ascending: false }],
    });
    setDevices(prev => ({ ...prev, [locationId]: data || [] }));
  };

  const fetchStaffCount = async (locationId: string) => {
    try {
      const rows = await apiDbQuery<any[]>({
        table: 'profiles',
        action: 'select',
        select: 'id',
        filters: [{ field: 'location_id', op: 'eq', value: locationId }],
        limit: 5000,
      });
      setStaffCounts(prev => ({ ...prev, [locationId]: rows?.length || 0 }));
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

      const [allRows, todayRows, next7Rows] = await Promise.all([
        apiDbQuery<any[]>({
          table: 'test_drives',
          action: 'select',
          select: 'id',
          filters: [
            { field: 'location_id', op: 'eq', value: locationId },
            { field: 'status', op: 'in', value: ['confirmed', 'show', 'in_progress', 'scheduled'] },
          ],
          limit: 5000,
        }),
        apiDbQuery<any[]>({
          table: 'test_drives',
          action: 'select',
          select: 'id',
          filters: [
            { field: 'location_id', op: 'eq', value: locationId },
            { field: 'scheduled_date', op: 'eq', value: todayStr },
            { field: 'status', op: 'in', value: ['confirmed', 'show', 'in_progress', 'scheduled'] },
          ],
          limit: 5000,
        }),
        apiDbQuery<any[]>({
          table: 'test_drives',
          action: 'select',
          select: 'id',
          filters: [
            { field: 'location_id', op: 'eq', value: locationId },
            { field: 'scheduled_date', op: 'gte', value: todayStr },
            { field: 'scheduled_date', op: 'lte', value: next7Str },
            { field: 'status', op: 'in', value: ['confirmed', 'show', 'in_progress', 'scheduled'] },
          ],
          limit: 5000,
        }),
      ]);

      setTestDriveCounts(prev => ({ ...prev, [locationId]: allRows?.length || 0 }));
      setTestDriveTodayCounts(prev => ({ ...prev, [locationId]: todayRows?.length || 0 }));
      setTestDriveNext7DaysCounts(prev => ({ ...prev, [locationId]: next7Rows?.length || 0 }));
    } catch (err) {
      console.error('Error fetching test drive count:', err);
      setTestDriveCounts(prev => ({ ...prev, [locationId]: 0 }));
      setTestDriveTodayCounts(prev => ({ ...prev, [locationId]: 0 }));
      setTestDriveNext7DaysCounts(prev => ({ ...prev, [locationId]: 0 }));
    }
  };

  const fetchSchedules = async (locationId: string) => {
    const data = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: 'id, scheduled_date, scheduled_time, status',
      filters: [
        { field: 'location_id', op: 'eq', value: locationId },
        { field: 'scheduled_date', op: 'gte', value: new Date().toISOString().split('T')[0] },
      ],
      order: [
        { field: 'scheduled_date', ascending: true },
        { field: 'scheduled_time', ascending: true },
      ],
    });
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

  const openAdvBookingDaysDialog = (locationId: string) => {
    setAdvBookingDays(advBookingDaysMap[locationId] ?? 30);
    setAdvBookingDaysDialog(locationId);
  };

  const saveAdvBookingDays = async () => {
    if (!advBookingDaysDialog) return;
    try {
      await apiDbQuery({
        table: 'locations',
        action: 'update',
        payload: { advance_booking_days: advBookingDays },
        filters: [{ field: 'id', op: 'eq', value: advBookingDaysDialog }],
      });
      setAdvBookingDaysMap(prev => ({ ...prev, [advBookingDaysDialog]: advBookingDays }));
      toast({ title: 'Booking window saved', description: `Customers can book up to ${advBookingDays} days ahead` });
      setAdvBookingDaysDialog(null);
      fetchLocations();
    } catch (err: any) {
      toast({ title: 'Failed to save booking window', description: err.message, variant: 'destructive' });
    }
  };

  const saveSlotDuration = async () => {
    if (!slotDurationDialog) return;
    try {
      try {
        await apiDbQuery({
          table: 'locations',
          action: 'update',
          payload: { slot_duration_minutes: slotDuration },
          filters: [{ field: 'id', op: 'eq', value: slotDurationDialog }],
        });
      } catch (error: any) {
        if (!isMissingSlotDurationColumnError(error)) throw error;

        const location = locations.find((loc) => loc.id === slotDurationDialog);
        const metadata = {
          ...(location?.metadata || {}),
          slot_duration_minutes: slotDuration,
        };

        try {
          await apiDbQuery({
            table: 'locations',
            action: 'update',
            payload: { metadata } as any,
            filters: [{ field: 'id', op: 'eq', value: slotDurationDialog }],
          });
        } catch (metadataError: any) {
          if (isMissingMetadataColumnError(metadataError)) {
            throw new Error('Database schema is outdated. Please run the schema repair script and apply the SQL migration in your database console.');
          }
          throw metadataError;
        }
      }

      setSlotDurations((prev) => ({ ...prev, [slotDurationDialog]: slotDuration }));
      toast({ title: 'Slot duration saved successfully', description: `${slotDuration} minutes per slot` });
      setSlotDurationDialog(null);
      fetchLocations();
    } catch (err: any) {
      toast({ title: 'Failed to save slot duration', description: err.message, variant: 'destructive' });
    }
  };

  const validateLocationStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Location name is required';
    if (!formData.address.trim()) errs.address = 'Address is required';
    if (!formData.city.trim()) errs.city = 'City is required';
    if (!formData.state.trim()) errs.state = 'State/Province is required';
    if (!formData.country.trim()) errs.country = 'Country is required';
    setLocErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateLocationStep2 = (): boolean => {
    const step2Errs: Record<string, string> = {};
    if (!formData.phone.trim()) {
      step2Errs.phone = 'Phone is required';
    } else {
      const selectedCountry = COUNTRIES.find(c => c.name === formData.country);
      if (selectedCountry) {
        // Strip dial code prefix if the user included it, then validate the local part
        let localPart = formData.phone.replace(/[\s\-()]/g, '');
        if (localPart.startsWith(selectedCountry.dialCode)) {
          localPart = localPart.slice(selectedCountry.dialCode.length);
        }
        const phoneErr = validatePhoneForCountry(localPart, selectedCountry.dialCode);
        if (phoneErr) step2Errs.phone = phoneErr;
      } else if (!/^\+?[\d\s\-(). ]{7,20}$/.test(formData.phone)) {
        step2Errs.phone = 'Enter a valid phone number';
      }
    }
    const emailErr = validateEmail(formData.email);
    if (emailErr) step2Errs.email = emailErr;
    if (!formData.currency_type) step2Errs.currency_type = 'Currency is required';
    setLocErrors(prev => ({ ...prev, ...step2Errs }));
    return Object.keys(step2Errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateLocationStep2()) return;
    const payload = { ...formData, dealer_id: dealerId };
    try {
      if (editingId) {
        await updateLocation(editingId, payload as Record<string, unknown>);
        toast({ title: 'Location updated' });
      } else {
        await createLocation(payload as Record<string, unknown>);
        toast({ title: 'Location added' });
      }
      setShowDialog(false);
      setStep(1);
      setEditingId(null);
      setFormData({ name: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', latitude: '', longitude: '', googleplaceid: '', maplink: '', currency_type: 'INR', businessUnitId: '', businessUnitName: '', salesOfficeId: '', salesOfficeName: '', plantId: '', plantName: '', brandId: '', brandName: '' });
      setLocErrors({});
      fetchLocations();
    } catch (err: any) {
      toast({ title: 'Failed to save location', description: err.message, variant: 'destructive' });
    }
  };

  const editLocation = (loc: any) => {
    setEditingId(loc.id);
    setFormData({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state || '',
      country: loc.country || 'India',
      phone: loc.phone || '',
      email: loc.email || '',
      latitude: loc.latitude || '',
      longitude: loc.longitude || '',
      googleplaceid: loc.googleplaceid || '',
      maplink: loc.maplink || '',
      currency_type: loc.currency_type || 'INR',
      businessUnitId: loc.businessUnitId || '',
      businessUnitName: loc.businessUnitName || '',
      salesOfficeId: loc.salesOfficeId || '',
      salesOfficeName: loc.salesOfficeName || '',
      plantId: loc.plantId || '',
      plantName: loc.plantName || '',
      brandId: loc.brandId || '',
      brandName: loc.brandName || '',
    });
    setLocErrors({});
    setStep(1);
    setShowDialog(true);
  };

  const openHoursDialog = async (locationId: string) => {
    const data = await listLocationOperatingHours({ locationId });
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
      await bulkUpsertLocationOperatingHours(
        hoursDialog,
        hours.map((h) => ({
          id: h.id || undefined,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
        })),
      );
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
      await apiDbQuery({
        table: 'location_devices',
        action: 'insert',
        values: {
        location_id: deviceDialog,
        name: newDevice.name,
        device_type: newDevice.device_type,
        serial_number: newDevice.serial_number || null,
        notes: newDevice.notes || null,
        is_active: true
        },
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
      await apiDbQuery({
        table: 'location_devices',
        action: 'delete',
        filters: [{ field: 'id', op: 'eq', value: deviceId }],
      });
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
      await apiDbQuery({
        table: 'location_devices',
        action: 'update',
        payload: { is_active: !isActive },
        filters: [{ field: 'id', op: 'eq', value: deviceId }],
      });
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
    try {
      const data = await listLocationSpecialPeriods({
        location_id: locationId,
      });
      setSpecialPeriods(data || []);
    } catch (error: any) {
      toast({ title: 'Failed to load saved records', description: error?.message || 'Unable to load periods', variant: 'destructive' });
      setSpecialPeriods([]);
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

      if (editingSpecialPeriodId) {
        await updateLocationSpecialPeriod(editingSpecialPeriodId, payload as any);
      } else {
        await createLocationSpecialPeriod({
          location_id: specialPeriodsDialog,
          ...payload,
        } as any);
      }

      toast({ title: editingSpecialPeriodId ? 'Special period updated' : 'Special period added' });
      resetSpecialPeriodForm();

      const refreshed = await listLocationSpecialPeriods({
        location_id: specialPeriodsDialog,
      });

      setSpecialPeriods(refreshed || []);
      fetchLocations();
    } catch (err: any) {
      toast({ title: 'Failed to add period', description: err.message, variant: 'destructive' });
    } finally { setSavingPeriod(false); }
  };

  const deleteSpecialPeriod = async (periodId: string) => {
    if (!confirm('Delete this special period?')) return;
    try {
      await deleteLocationSpecialPeriod(periodId);

      toast({ title: 'Period removed' });

      if (specialPeriodsDialog) {
        const refreshed = await listLocationSpecialPeriods({
          location_id: specialPeriodsDialog,
        });

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
  const currencies = [
    { code: 'INR', symbol: '₹' },
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
    { code: 'JPY', symbol: '¥' },
    { code: 'AED', symbol: 'د.إ' }, // Dirham
  ]
  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">Locations</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your dealership locations and devices</p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormData({ name: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', latitude: '', longitude: '', googleplaceid: '', maplink: '', currency_type: 'INR', businessUnitId: '', businessUnitName: '', salesOfficeId: '', salesOfficeName: '', plantId: '', plantName: '', brandId: '', brandName: '' }); setLocErrors({}); setStep(1); setShowDialog(true); }}
            className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </div>

        {/* Superadmin filter bar */}
        {isSuperAdmin && (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Dealer</Label>
                  <select
                    className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background"
                    value={filterDealerId}
                    onChange={e => setFilterDealerId(e.target.value)}
                  >
                    <option value="">All Dealers</option>
                    {allDealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Brand</Label>
                  <select
                    className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background"
                    value={filterBrandId}
                    onChange={e => setFilterBrandId(e.target.value)}
                  >
                    <option value="">All Brands</option>
                    {(filterDealerId
                      ? allBrandsForFilter.filter(b => b.dealer_id === filterDealerId)
                      : allBrandsForFilter
                    ).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Business Unit</Label>
                  <select
                    className="w-full h-8 px-2 border border-input rounded-md text-xs bg-background"
                    value={filterBUId}
                    onChange={e => setFilterBUId(e.target.value)}
                  >
                    <option value="">All BUs</option>
                    {(filterDealerId
                      ? businessUnits.filter(b => b.orgId === filterDealerId)
                      : businessUnits
                    ).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 flex-1 min-w-[120px]">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">City</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Search city..."
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                  />
                </div>
                {(filterDealerId || filterBrandId || filterBUId || filterCity) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs self-end"
                    onClick={() => { setFilterDealerId(''); setFilterBrandId(''); setFilterBUId(''); setFilterCity(''); }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{locations.length} location{locations.length !== 1 ? 's' : ''} shown</p>
            </CardContent>
          </Card>
        )}

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
              <Card key={loc.id} className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden border-border/50 rounded-lg text-xs p-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent border-b border-border/50 p-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer group/detail" onClick={() => setDetailLoc(loc)}>
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0 shadow-sm">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-heading font-bold text-foreground leading-tight truncate group-hover/detail:text-primary transition-colors">{loc.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{loc.address}</p>
                      <p className="text-xs text-muted-foreground truncate">{loc.city}{loc.state ? `, ${loc.state}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setDetailLoc(loc)} title="View Details">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 w-7 p-0" onClick={() => editLocation(loc)} title="Edit Location">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Badges row */}
                <div className="px-3 pt-2 flex flex-wrap items-center gap-1">
                  {(() => {
                    const s = getLocationStatus(loc.id);
                    return (
                      <Badge className={`text-[10px] font-semibold border ${s.open ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                        <span className="mr-1">●</span>{s.label}
                      </Badge>
                    );
                  })()}
                  {loc.brandName ? (
                    <Badge variant="secondary" className="text-[10px] font-medium flex items-center gap-1">
                      <Tag className="h-2.5 w-2.5" />{loc.brandName}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">No brand</Badge>
                  )}
                  {loc.currency_type && (
                    <Badge variant="outline" className="text-[10px] font-medium">{loc.currency_type}</Badge>
                  )}
                </div>

                <CardContent className="p-3 space-y-2">
                  {/* Compact stats row */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Drives', value: testDriveCounts[loc.id] || 0, icon: '📊' },
                      { label: 'Today', value: testDriveTodayCounts[loc.id] || 0, icon: '📅' },
                      { label: 'Staff', value: staffCounts[loc.id] || 0, icon: '👥' },
                      { label: 'Devices', value: (devices[loc.id] || []).filter(d => d.is_active).length, icon: '📱' },
                    ].map((stat, idx) => (
                      <div key={idx} className="rounded border border-border/40 bg-muted/10 p-1.5 text-center">
                        <div className="text-sm mb-0.5">{stat.icon}</div>
                        <div className="text-xs font-bold">{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Today hours pill */}
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/20 border border-border/30">
                    <Clock className="h-3.5 w-3.5 text-info shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{todayHoursByLocation[loc.id] || 'Hours not set'}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t border-border/50 pt-2">
                    {canManageSchedules ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-[11px] h-8 font-medium" onClick={() => openHoursDialog(loc.id)}>
                          <Clock className="h-3 w-3 mr-1" /> Hours
                        </Button>
                        <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600 text-[11px] h-8 font-medium" onClick={() => openSpecialPeriodsDialog(loc.id)}>
                          <CalendarX className="h-3 w-3 mr-1" /> Breaks
                        </Button>
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] h-8 font-medium" onClick={() => openScheduleDialog(loc.id)}>
                          <Calendar className="h-3 w-3 mr-1" /> Schedule
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
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

        {/* Add/Edit Dialog - Two Step */}
        <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setStep(1); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit' : 'Add'} Location</DialogTitle>
            </DialogHeader>
            {(() => {
              // Step 1: Basic Info
              // Step 2: Geo/Contact/Map/Currency
              const step1Fields = (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Country <span className="text-destructive">*</span></Label>
                    <select
                      className={cn('w-full h-9 px-3 py-2 border rounded-md text-sm bg-background', locErrors.country ? 'border-destructive' : 'border-input')}
                      value={formData.country}
                      onChange={e => { setFormData(p => ({ ...p, country: e.target.value })); setLocErrors(p => ({ ...p, country: '' })); }}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                    </select>
                    {locErrors.country && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.country}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.name}
                      placeholder="e.g. Mumbai Showroom"
                      className={cn(locErrors.name ? 'border-destructive focus-visible:ring-destructive/30' : '')}
                      onChange={e => { setFormData(p => ({ ...p, name: e.target.value })); setLocErrors(p => ({ ...p, name: '' })); }}
                    />
                    {locErrors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.address}
                      placeholder="Street address"
                      className={cn(locErrors.address ? 'border-destructive focus-visible:ring-destructive/30' : '')}
                      onChange={e => { setFormData(p => ({ ...p, address: e.target.value })); setLocErrors(p => ({ ...p, address: '' })); }}
                    />
                    {locErrors.address && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.address}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>City <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.city}
                        placeholder="City"
                        className={cn(locErrors.city ? 'border-destructive focus-visible:ring-destructive/30' : '')}
                        onChange={e => { setFormData(p => ({ ...p, city: e.target.value })); setLocErrors(p => ({ ...p, city: '' })); }}
                      />
                      {locErrors.city && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.city}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>State / Province <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.state}
                        placeholder="State"
                        className={cn(locErrors.state ? 'border-destructive focus-visible:ring-destructive/30' : '')}
                        onChange={e => { setFormData(p => ({ ...p, state: e.target.value })); setLocErrors(p => ({ ...p, state: '' })); }}
                      />
                      {locErrors.state && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.state}</p>}
                    </div>
                  </div>
                  {/* Hierarchy dropdowns */}
                  {businessUnits.length > 0 && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Business Unit</Label>
                        <select
                          className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm bg-background"
                          value={formData.businessUnitId}
                          onChange={e => {
                            const bu = businessUnits.find(b => b.id === e.target.value);
                            setFormData(p => ({ ...p, businessUnitId: e.target.value, businessUnitName: bu?.name ?? '', salesOfficeId: '', salesOfficeName: '', plantId: '', plantName: '' }));
                          }}
                        >
                          <option value="">— None —</option>
                          {businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name} ({bu.code})</option>)}
                        </select>
                      </div>
                      {formData.businessUnitId && salesOffices.filter(so => so.businessUnitId === formData.businessUnitId).length > 0 && (
                        <div className="space-y-1.5">
                          <Label>Sales Office</Label>
                          <select
                            className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm bg-background"
                            value={formData.salesOfficeId}
                            onChange={e => {
                              const so = salesOffices.find(s => s.id === e.target.value);
                              setFormData(p => ({ ...p, salesOfficeId: e.target.value, salesOfficeName: so?.name ?? '', plantId: '', plantName: '' }));
                            }}
                          >
                            <option value="">— None —</option>
                            {salesOffices.filter(so => so.businessUnitId === formData.businessUnitId).map(so => (
                              <option key={so.id} value={so.id}>{so.name} ({so.salesOfficeCode})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {formData.salesOfficeId && plants.filter(p => p.salesOfficeId === formData.salesOfficeId).length > 0 && (
                        <div className="space-y-1.5">
                          <Label>Plant</Label>
                          <select
                            className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm bg-background"
                            value={formData.plantId}
                            onChange={e => {
                              const pl = plants.find(p => p.id === e.target.value);
                              setFormData(p => ({ ...p, plantId: e.target.value, plantName: pl?.name ?? '' }));
                            }}
                          >
                            <option value="">— None —</option>
                            {plants.filter(pl => pl.salesOfficeId === formData.salesOfficeId).map(pl => (
                              <option key={pl.id} value={pl.id}>{pl.name} ({pl.plantCode})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                  {/* Brand assignment */}
                  {dealerBrands.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Brand <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <select
                        className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm bg-background"
                        value={formData.brandId}
                        onChange={e => {
                          const br = dealerBrands.find(b => b.id === e.target.value);
                          setFormData(p => ({ ...p, brandId: e.target.value, brandName: br?.name ?? '' }));
                        }}
                      >
                        <option value="">— None —</option>
                        {dealerBrands.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setShowDialog(false); setStep(1); }}>Cancel</Button>
                    <Button onClick={() => { if (validateLocationStep1()) setStep(2); }} className="bg-primary text-primary-foreground hover:bg-primary/90">Next</Button>
                  </div>
                </div>
              );
              const selectedCountry = COUNTRIES.find(c => c.name === formData.country);
              const step2Fields = (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Phone <span className="text-destructive">*</span></Label>
                    {selectedCountry && (
                      <p className="text-[11px] text-muted-foreground">{selectedCountry.flag} {selectedCountry.name} ({selectedCountry.dialCode}) — {selectedCountry.phoneHint}</p>
                    )}
                    <Input
                      value={formData.phone}
                      placeholder={selectedCountry ? `${selectedCountry.dialCode} ...` : '+XX ...'}
                      className={cn(locErrors.phone ? 'border-destructive focus-visible:ring-destructive/30' : '')}
                      onChange={e => { setFormData(p => ({ ...p, phone: e.target.value })); setLocErrors(p => ({ ...p, phone: '' })); }}
                    />
                    {locErrors.phone && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      value={formData.email}
                      placeholder="location@dealership.com"
                      className={cn(locErrors.email ? 'border-destructive focus-visible:ring-destructive/30' : '')}
                      onChange={e => { setFormData(p => ({ ...p, email: e.target.value })); setLocErrors(p => ({ ...p, email: '' })); }}
                    />
                    {locErrors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Currency <span className="text-destructive">*</span></Label>
                    <select
                      className={cn('w-full h-9 px-3 py-2 border rounded-md text-sm bg-background', locErrors.currency_type ? 'border-destructive' : 'border-input')}
                      value={formData.currency_type}
                      onChange={e => { setFormData(p => ({ ...p, currency_type: e.target.value })); setLocErrors(p => ({ ...p, currency_type: '' })); }}
                    >
                      {currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                      ))}
                    </select>
                    {locErrors.currency_type && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {locErrors.currency_type}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Latitude</Label><Input value={formData.latitude} onChange={e => setFormData(p => ({ ...p, latitude: e.target.value }))} placeholder="e.g. 28.6139" /></div>
                    <div className="space-y-1.5"><Label>Longitude</Label><Input value={formData.longitude} onChange={e => setFormData(p => ({ ...p, longitude: e.target.value }))} placeholder="e.g. 77.2090" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Google Place ID</Label>
                    <Input value={formData.googleplaceid} onChange={e => setFormData(p => ({ ...p, googleplaceid: e.target.value }))} placeholder="Google Place ID (optional)" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custom Map Link</Label>
                    <Input value={formData.maplink} onChange={e => setFormData(p => ({ ...p, maplink: e.target.value }))} placeholder="Paste Google Maps link (optional)" />
                  </div>
                  <div className="flex justify-between gap-2 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button onClick={handleSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">{editingId ? 'Update' : 'Add'} Location</Button>
                  </div>
                </div>
              );
              return step === 1 ? step1Fields : step2Fields;
            })()}
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
            <div className="grid grid-cols-1 gap-2">
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
                      className={`p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${slotDuration === duration
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

        {/* Advance Booking Days Dialog */}
        <Dialog open={!!advBookingDaysDialog} onOpenChange={() => setAdvBookingDaysDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
                Advance Booking Window
              </DialogTitle>
              <DialogDescription>
                How many days ahead customers can book at {locations.find(l => l.id === advBookingDaysDialog)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Select Days Ahead</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 21, 30, 45, 60, 90, 120].map(d => (
                    <button
                      key={d}
                      onClick={() => setAdvBookingDays(d)}
                      className={`p-2.5 rounded-lg border-2 text-sm font-semibold transition-colors ${
                        advBookingDays === d
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                          : 'border-border bg-card hover:border-emerald-300'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm shrink-0">Custom:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={advBookingDays}
                    onChange={e => setAdvBookingDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="h-9 w-24"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Window:</span> {advBookingDays} days from today
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The walk-in and online booking forms will block dates beyond this limit.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAdvBookingDaysDialog(null)}>Cancel</Button>
              <Button onClick={saveAdvBookingDays} className="bg-emerald-600 text-white hover:bg-emerald-700">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Location Detail Sheet */}
      <Sheet open={!!detailLoc} onOpenChange={(open) => { if (!open) setDetailLoc(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          {detailLoc && (() => {
            const loc = detailLoc;
            const country = COUNTRIES.find(c => c.name === loc.country);
            const status = getLocationStatus(loc.id);
            return (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center shrink-0 shadow">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <SheetHeader className="p-0 text-left space-y-0">
                        <SheetTitle className="font-heading text-lg leading-tight">{loc.name}</SheetTitle>
                      </SheetHeader>
                      <p className="text-sm text-muted-foreground mt-0.5">{loc.address}</p>
                      <p className="text-sm text-muted-foreground">{loc.city}{loc.state ? `, ${loc.state}` : ''}</p>
                      {loc.country && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <span>{country?.flag ?? '🌍'}</span>
                          <span>{loc.country}</span>
                          {country && <span className="font-mono text-[10px] bg-muted/60 px-1 rounded">{country.dialCode}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status & badges */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge className={`text-xs font-semibold border ${status.open ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                      <span className="mr-1">●</span>{status.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{dealerNamesById[loc.dealer_id] || 'Unknown'}</Badge>
                    {loc.brandName && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Tag className="h-3 w-3" />{loc.brandName}
                      </Badge>
                    )}
                    {loc.currency_type && <Badge variant="outline" className="text-xs">{loc.currency_type}</Badge>}
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Total Drives', value: testDriveCounts[loc.id] || 0, icon: '📊' },
                      { label: 'Today', value: testDriveTodayCounts[loc.id] || 0, icon: '📅' },
                      { label: 'Next 7 Days', value: testDriveNext7DaysCounts[loc.id] || 0, icon: '📈' },
                      { label: 'Staff', value: staffCounts[loc.id] || 0, icon: '👥' },
                      { label: 'Devices', value: (devices[loc.id] || []).filter(d => d.is_active).length, icon: '📱' },
                      { label: 'Slot', value: `${slotDurations[loc.id] || 30}m`, icon: '⏱️' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
                        <div className="text-lg mb-0.5">{s.icon}</div>
                        <div className="text-sm font-bold">{s.value}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Contact */}
                  {(loc.phone || loc.email) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
                      <div className="space-y-1.5">
                        {loc.phone && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <Phone className="h-4 w-4 text-info shrink-0" />
                            <span className="text-sm">{loc.phone}</span>
                          </div>
                        )}
                        {loc.email && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <Mail className="h-4 w-4 text-info shrink-0" />
                            <span className="text-sm truncate">{loc.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hierarchy */}
                  {(loc.businessUnitName || loc.salesOfficeName || loc.plantName || loc.brandName) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation Hierarchy</h4>
                      <div className="rounded-lg border border-border/30 overflow-hidden divide-y divide-border/30">
                        {loc.brandName && (
                          <div className="flex items-center gap-2.5 p-2.5 bg-muted/10">
                            <Tag className="h-4 w-4 text-pink-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground w-16 shrink-0">Brand</span>
                            <span className="text-sm font-medium">{loc.brandName}</span>
                          </div>
                        )}
                        {loc.businessUnitName && (
                          <div className="flex items-center gap-2.5 p-2.5 bg-muted/10">
                            <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground w-16 shrink-0">Business Unit</span>
                            <span className="text-sm font-medium">{loc.businessUnitName}</span>
                          </div>
                        )}
                        {loc.salesOfficeName && (
                          <div className="flex items-center gap-2.5 p-2.5 bg-muted/10">
                            <Layers className="h-4 w-4 text-violet-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground w-16 shrink-0">Sales Office</span>
                            <span className="text-sm font-medium">{loc.salesOfficeName}</span>
                          </div>
                        )}
                        {loc.plantName && (
                          <div className="flex items-center gap-2.5 p-2.5 bg-muted/10">
                            <Factory className="h-4 w-4 text-orange-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground w-16 shrink-0">Plant</span>
                            <span className="text-sm font-medium">{loc.plantName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location Data */}
                  {(loc.latitude || loc.longitude || loc.googleplaceid || loc.maplink) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location Data</h4>
                      <div className="space-y-1.5">
                        {loc.latitude && loc.longitude && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground shrink-0">Lat / Lng</span>
                            <span className="text-sm font-mono">{loc.latitude}, {loc.longitude}</span>
                          </div>
                        )}
                        {loc.googleplaceid && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground shrink-0">Place ID</span>
                            <span className="text-sm font-mono truncate">{loc.googleplaceid}</span>
                          </div>
                        )}
                        {loc.maplink && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                            <a href={loc.maplink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 underline truncate">Open Map</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Operating Hours */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Hours</h4>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                      <Clock className="h-4 w-4 text-info shrink-0" />
                      <span className="text-sm">{todayHoursByLocation[loc.id] || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Slot: {slotDurations[loc.id] || 30}m</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Book ahead: {advBookingDaysMap[loc.id] ?? 30}d</span>
                    </div>
                  </div>

                  {/* Devices */}
                  {devices[loc.id]?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5" /> Devices ({devices[loc.id].filter(d => d.is_active).length} active / {devices[loc.id].length} total)
                      </h4>
                      <div className="space-y-1.5">
                        {devices[loc.id].map(dev => (
                          <div key={dev.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{dev.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{dev.device_type}{dev.serial_number ? ` · ${dev.serial_number}` : ''}</p>
                              </div>
                            </div>
                            <Badge variant={dev.is_active ? 'default' : 'secondary'} className="text-xs shrink-0 ml-2">
                              {dev.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {canManageSchedules && (
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9" onClick={() => { setDetailLoc(null); editLocation(loc); }}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Location
                        </Button>
                        <Button size="sm" className="bg-info text-info-foreground hover:bg-info/90 text-xs h-9" onClick={() => { setDetailLoc(null); openHoursDialog(loc.id); }}>
                          <Clock className="h-3.5 w-3.5 mr-1.5" /> Hours
                        </Button>
                        <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600 text-xs h-9" onClick={() => { setDetailLoc(null); openSpecialPeriodsDialog(loc.id); }}>
                          <CalendarX className="h-3.5 w-3.5 mr-1.5" /> Breaks
                        </Button>
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9" onClick={() => { setDetailLoc(null); openScheduleDialog(loc.id); }}>
                          <Calendar className="h-3.5 w-3.5 mr-1.5" /> Schedule
                        </Button>
                        <Button size="sm" className="bg-violet-500 text-white hover:bg-violet-600 text-xs h-9" onClick={() => { setDetailLoc(null); openSlotDurationDialog(loc.id); }}>
                          <Clock className="h-3.5 w-3.5 mr-1.5" /> Slot: {slotDurations[loc.id] || 30}m
                        </Button>
                        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs h-9" onClick={() => { setDetailLoc(null); openAdvBookingDaysDialog(loc.id); }}>
                          <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Book Ahead: {advBookingDaysMap[loc.id] ?? 30}d
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default LocationsPage;
