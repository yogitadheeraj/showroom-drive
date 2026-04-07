import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import VehicleSpecCard from '@/components/booking/VehicleSpecCard';
import { Car, CheckCircle, Zap, ArrowRight, MapPin, Clock, User, ChevronRight, Shield, GitCompareArrows, Map as MapIcon, ExternalLink, Mail, ShieldCheck, KeyRound, ClipboardCheck, MessageSquare, Building2, Menu, X , ArrowLeft} from 'lucide-react';
import { z } from 'zod';
import { format, isBefore, startOfDay } from 'date-fns';
import { checkAndReleaseNoShowBookings, getAvailableTimeSlots, getAvailableVehicles } from '@/lib/slotAvailability';

const STEPS = [
  { id: 'vehicle', label: 'Vehicle', icon: Car },
  { id: 'date', label: 'Date', icon: Clock },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'info', label: 'Your Info', icon: User },
];

const JOURNEY_PREVIEW_STEPS = [
  {
    id: 1,
    icon: Mail,
    title: 'Booking Confirmation',
    description: 'You receive confirmation updates via WhatsApp and email after booking.',
  },
  {
    id: 2,
    icon: Shield,
    title: 'License Upload',
    description: 'Upload your driving license before arriving if it is not already uploaded.',
  },
  {
    id: 3,
    icon: ShieldCheck,
    title: 'Security Verification',
    description: 'Security team verifies your license details at the showroom.',
  },
  {
    id: 4,
    icon: KeyRound,
    title: 'Key Handover',
    description: 'Assigned sales team briefs you and hands over vehicle keys.',
  },
  {
    id: 5,
    icon: ClipboardCheck,
    title: 'Pre & Post Inspection',
    description: 'Security records inspection before and after the test drive with notes.',
  },
  {
    id: 6,
    icon: CheckCircle,
    title: 'Formalities Complete',
    description: 'Security marks formalities complete and updates the status trail.',
  },
  {
    id: 7,
    icon: Car,
    title: 'Return Key To Sales',
    description: 'Return keys to assigned sales executive to complete your journey.',
  },
  {
    id: 8,
    icon: MessageSquare,
    title: 'Feedback & Purchase Help',
    description: 'Share feedback and ask sales team about purchase, finance, and offers.',
  },
];

const bookingSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().regex(/^[+]?[\d\s-]{10,15}$/, 'Invalid phone number'),
  preferredContact: z.enum(['phone', 'email', 'whatsapp']),
  locationId: z.string().uuid('Please select a location'),
  vehicleId: z.string().uuid('Please select a vehicle'),
  scheduledDate: z.string().min(1, 'Please select a date'),
  scheduledTime: z.string().min(1, 'Please select a time'),
});

const isMissingSpecialPeriodsTableError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes("location_special_periods") && message.includes('schema cache');
};

const getLocationSlotDuration = (location: any) => {
  const fromColumn = Number(location?.slot_duration_minutes);
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn;

  const fromMetadata = Number(location?.metadata?.slot_duration_minutes);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata;

  return 30;
};

const normalizeModelToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const QUICK_LOCATION_PAGE_SIZE = 4;

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [dealerNamesById, setDealerNamesById] = useState<Record<string, string>>({});
  const [brandsByDealerId, setBrandsByDealerId] = useState<Record<string, string[]>>({});
  const [operatingHours, setOperatingHours] = useState<any[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [specialPeriods, setSpecialPeriods] = useState<any[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', preferredContact: 'phone',
    locationId: '', vehicleId: '', scheduledDate: '', scheduledTime: '',
    selectedModel: '', selectedVariantVehicleId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [availableVehiclesForSlot, setAvailableVehiclesForSlot] = useState<any[]>([]);
  const [loadingVehiclesForSlot, setLoadingVehiclesForSlot] = useState(false);
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState<'new' | 'used'>('new');
  const [vehicleSegmentFilter, setVehicleSegmentFilter] = useState<'all' | 'four_wheeler' | 'two_wheeler'>('all');
  const [quickLocationPage, setQuickLocationPage] = useState(0);
  const { toast } = useToast();

  // Auto-select vehicle from URL (coming from compare page)
  useEffect(() => {
    const vehicleId = searchParams.get('vehicleId');
    const deepLinkedDate = searchParams.get('scheduledDate');
    const deepLinkedTime = searchParams.get('scheduledTime');
    const deepLinkedLocationId = searchParams.get('locationId');

    if (deepLinkedDate || deepLinkedTime || deepLinkedLocationId) {
      setFormData((prev) => ({
        ...prev,
        scheduledDate: deepLinkedDate || prev.scheduledDate,
        scheduledTime: deepLinkedTime || prev.scheduledTime,
        locationId: deepLinkedLocationId || prev.locationId,
      }));
    }

    if (vehicleId && allVehicles.length > 0) {
      const v = allVehicles.find(veh => veh.id === vehicleId);
      if (v) {
        setFormData(prev => ({
          ...prev,
          selectedModel: `${v.brand}|${v.model}`,
          vehicleId: v.id,
          selectedVariantVehicleId: v.is_demo ? (v.demo_for_vehicle_id || '') : v.id,
          locationId: v.location_id,
        }));
      }
    }

    const modelName = searchParams.get('modelname') || searchParams.get('modelName');
    if (!modelName || allVehicles.length === 0) {
      if (deepLinkedDate || deepLinkedTime || deepLinkedLocationId) {
        setStep(0);
      }
      return;
    }

    const normalizedParam = normalizeModelToken(decodeURIComponent(modelName));
    const matched = allVehicles.find((vehicle) => {
      const modelOnly = normalizeModelToken(vehicle.model || '');
      const brandAndModel = normalizeModelToken(`${vehicle.brand || ''} ${vehicle.model || ''}`);
      return modelOnly === normalizedParam || brandAndModel === normalizedParam;
    });

    if (matched) {
      const matchedModelKey = `${matched.brand}|${matched.model}`;
      const locationMatchedVehicle = deepLinkedLocationId
        ? allVehicles.find((vehicle) =>
            vehicle.location_id === deepLinkedLocationId && `${vehicle.brand}|${vehicle.model}` === matchedModelKey
          )
        : null;

      setFormData((prev) => ({
        ...prev,
        selectedModel: matchedModelKey,
        locationId: locationMatchedVehicle?.location_id || '',
        vehicleId: locationMatchedVehicle?.id || '',
        selectedVariantVehicleId: locationMatchedVehicle?.id || '',
        scheduledDate: deepLinkedDate || prev.scheduledDate,
        scheduledTime: deepLinkedTime || '',
      }));

      if (deepLinkedDate && deepLinkedTime && locationMatchedVehicle?.location_id) {
        setStep(4);
      } else if (deepLinkedDate && locationMatchedVehicle?.location_id) {
        setStep(3);
      } else if (deepLinkedDate) {
        setStep((prevStep) => (prevStep < 2 ? 2 : prevStep));
      } else {
        setStep((prevStep) => (prevStep < 1 ? 1 : prevStep));
      }
    }
  }, [searchParams, allVehicles]);

  // Load all active available vehicles, locations, and operating hours
  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).eq('is_available', true),
      supabase.from('locations').select('*').eq('is_active', true),
      supabase.from('dealers').select('id, name').eq('is_active', true),
      supabase.from('brands').select('dealer_id, name').order('name'),
      supabase.from('location_operating_hours').select('*'),
      supabase.from('location_blocked_slots').select('*'),
      supabase.from('location_special_periods').select('*'),
    ]).then(([vRes, lRes, dRes, bRes, ohRes, bsRes, spRes]) => {
      setAllVehicles(vRes.data || []);
      let locs = lRes.data || [];
      // Hide locations for dealer admin if flagged
      const role = localStorage.getItem('app_role');
      if (role === 'dealer_admin') {
        locs = locs.filter((l: any) => !l.disabled_for_dealer_admin);
      }
      setLocations(locs);
      const dealerNameMap = (dRes.data || []).reduce((acc: Record<string, string>, dealer: any) => {
        acc[dealer.id] = dealer.name;
        return acc;
      }, {});
      const brandMap = (bRes.data || []).reduce((acc: Record<string, string[]>, brand: any) => {
        if (!acc[brand.dealer_id]) acc[brand.dealer_id] = [];
        acc[brand.dealer_id].push(brand.name);
        return acc;
      }, {});
      setDealerNamesById(dealerNameMap);
      setBrandsByDealerId(brandMap);
      setOperatingHours(ohRes.data || []);
      setBlockedSlots(bsRes.data || []);

      if (spRes.error && isMissingSpecialPeriodsTableError(spRes.error)) {
        setSpecialPeriods([]);
      } else {
        setSpecialPeriods(spRes.data || []);
      }
    });
  }, []);

  const categoryFilteredVehicles = useMemo(() => {
    return allVehicles.filter((vehicle) => {
      if (vehicle.is_demo) return false;
      if (vehicleCategoryFilter === 'used' && !vehicle.is_used) return false;
      if (vehicleCategoryFilter === 'new' && !(vehicle.is_new && !vehicle.is_used)) return false;
      if (vehicleSegmentFilter !== 'all' && (vehicle.vehicle_segment || 'four_wheeler') !== vehicleSegmentFilter) return false;
      return true;
    });
  }, [allVehicles, vehicleCategoryFilter, vehicleSegmentFilter]);

  // Unique models grouped by type
  const modelGroups = useMemo(() => {
    const modelMap = new Map<string, { brand: string; model: string; engine_type: string; vehicles: any[] }>();
    categoryFilteredVehicles.forEach(v => {
      const key = `${v.brand}|${v.model}`;
      if (!modelMap.has(key)) {
        modelMap.set(key, { brand: v.brand, model: v.model, engine_type: v.engine_type || 'petrol', vehicles: [] });
      }
      modelMap.get(key)!.vehicles.push(v);
    });
    const all = Array.from(modelMap.values());
    return {
      ev: all.filter(m => m.engine_type === 'electric'),
      hybrid: all.filter(m => m.engine_type === 'hybrid'),
      ice: all.filter(m => m.engine_type !== 'electric' && m.engine_type !== 'hybrid'),
    };
  }, [categoryFilteredVehicles]);

  const selectedModelKey = formData.selectedModel;
  const modelVehicles = useMemo(() => {
    if (!selectedModelKey) return [];
    return categoryFilteredVehicles.filter(v => `${v.brand}|${v.model}` === selectedModelKey);
  }, [selectedModelKey, categoryFilteredVehicles]);

  const getDemoVehicleForVariantAtLocation = (variantVehicleId: string, locationId: string) => {
    if (!variantVehicleId || !locationId) return null;
    return allVehicles.find((vehicle) =>
      vehicle.location_id === locationId &&
      vehicle.is_demo &&
      vehicle.demo_for_vehicle_id === variantVehicleId &&
      vehicle.is_available
    ) || null;
  };

  const selectedVariantVehicle = allVehicles.find((vehicle) => vehicle.id === formData.selectedVariantVehicleId);
  const isDemoMatchForSelectedVariant = (vehicle: any) => {
    if (!vehicle?.is_demo) return false;
    if (!formData.selectedVariantVehicleId) return false;
    return vehicle.demo_for_vehicle_id === formData.selectedVariantVehicleId;
  };

  // Locations that have the selected model available
  const availableLocations = useMemo(() => {
    const locIds = new Set(modelVehicles.map(v => v.location_id));
    return locations.filter(l => locIds.has(l.id));
  }, [modelVehicles, locations]);

  // Get a sample vehicle for spec display (first vehicle of selected model)
  const sampleVehicle = modelVehicles[0];

  // Selected vehicle (specific variant at location)
  const selectedVehicle = allVehicles.find(v => v.id === formData.vehicleId);
  const selectedLocation = locations.find(l => l.id === formData.locationId);

  const handleModelSelect = (modelKey: string) => {
    const matchedVehicleAtLocation = formData.locationId
      ? categoryFilteredVehicles.find((vehicle) => vehicle.location_id === formData.locationId && `${vehicle.brand}|${vehicle.model}` === modelKey)
      : null;

    const resolvedVehicleId = (() => {
      if (!matchedVehicleAtLocation) return '';
      if (vehicleCategoryFilter === 'used') return matchedVehicleAtLocation.id;
      return getDemoVehicleForVariantAtLocation(matchedVehicleAtLocation.id, matchedVehicleAtLocation.location_id)?.id || '';
    })();

    setFormData((prev) => ({
      ...prev,
      selectedModel: modelKey,
      selectedVariantVehicleId: matchedVehicleAtLocation?.id || '',
      vehicleId: resolvedVehicleId,
    }));

    if (formData.scheduledDate && formData.locationId) {
      setStep(3);
      return;
    }

    if (formData.scheduledDate) {
      setStep(2);
      return;
    }

    setStep(1);
  };

  const getEffectiveHoursForDate = (locationId: string, dateStr: string) => {
    if (!locationId || !dateStr) return null;

    const special = specialPeriods.find((p: any) =>
      p.location_id === locationId &&
      p.start_date <= dateStr &&
      p.end_date >= dateStr
    );

    if (special) {
      if (special.is_full_closure) {
        return {
          location_id: locationId,
          is_closed: true,
          open_time: null,
          close_time: null,
          source: 'special',
          source_name: special.name,
        };
      }

      return {
        location_id: locationId,
        is_closed: false,
        open_time: special.modified_open_time,
        close_time: special.modified_close_time,
        source: 'special',
        source_name: special.name,
      };
    }

    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
    const regular = operatingHours.find((oh: any) => oh.location_id === locationId && oh.day_of_week === dayOfWeek);
    if (!regular) return null;

    return {
      ...regular,
      source: 'regular',
      source_name: null,
    };
  };

  // Get effective operating hours for selected location and date
  const selectedDateHours = useMemo(() => {
    if (!formData.locationId || !formData.scheduledDate) return null;
    return getEffectiveHoursForDate(formData.locationId, formData.scheduledDate);
  }, [formData.locationId, formData.scheduledDate, operatingHours, specialPeriods]);

  useEffect(() => {
    const loadTimeSlots = async () => {
      if (!formData.locationId || !formData.scheduledDate || !formData.vehicleId || selectedDateHours?.is_closed) {
        setTimeSlots([]);
        return;
      }

      setLoadingTimeSlots(true);

      const location = locations.find((l: any) => l.id === formData.locationId);
      const configuredDuration = getLocationSlotDuration(location);
      setSlotDurationMinutes(configuredDuration);

      await checkAndReleaseNoShowBookings(formData.locationId, formData.scheduledDate);

      const { slots, error } = await getAvailableTimeSlots(formData.locationId, formData.scheduledDate, configuredDuration);
      if (error) {
        setTimeSlots([]);
        setLoadingTimeSlots(false);
        return;
      }

      const { data: vehicleBookings } = await supabase
        .from('test_drives')
        .select('scheduled_time, slot_duration_minutes')
        .eq('vehicle_id', formData.vehicleId)
        .eq('location_id', formData.locationId)
        .eq('scheduled_date', formData.scheduledDate)
        .in('status', ['scheduled', 'confirmed', 'show', 'in_progress']);

      // Check if selected date is today
      const now = new Date();
      const currentDateStr = now.toISOString().split('T')[0];
      const isToday = formData.scheduledDate === currentDateStr;
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();


      // Enforce: Only allow booking if slot starts at least 30 mins before closing
      const closeTimeStr = selectedDateHours?.close_time;
      let closeTimeMinutes = null;
      if (closeTimeStr) {
        const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);
        closeTimeMinutes = closeHour * 60 + closeMin;
      }

      const filteredSlots = (slots || []).filter((slot: any) => {
        const slotBlocked = blockedSlots.some((bs: any) =>
          bs.location_id === formData.locationId &&
          bs.blocked_date === formData.scheduledDate &&
          slot.startTime >= bs.start_time.substring(0, 5) &&
          slot.startTime < bs.end_time.substring(0, 5)
        );
        if (slotBlocked) return false;

        // Filter out past slots if date is today
        if (isToday) {
          if (slot.startMinutes < currentTimeMinutes) {
            return false;
          }
        }

        // Enforce 30 min before closing
        if (closeTimeMinutes !== null && slot.startMinutes > closeTimeMinutes - 30) {
          return false;
        }

        const slotStart = slot.startMinutes;
        const slotEnd = slot.endMinutes;

        const hasVehicleConflict = (vehicleBookings || []).some((booking: any) => {
          if (!booking.scheduled_time) return false;
          const [bh, bm] = booking.scheduled_time.substring(0, 5).split(':').map(Number);
          const bookingStart = bh * 60 + bm;
          const bookingEnd = bookingStart + Number(booking.slot_duration_minutes || configuredDuration);
          return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
        });

        return !hasVehicleConflict;
      }).map((slot: any) => ({ startTime: slot.startTime, endTime: slot.endTime }));

      if (formData.scheduledTime && !filteredSlots.some((s: any) => s.startTime === formData.scheduledTime)) {
        setFormData((p) => ({ ...p, scheduledTime: '' }));
      }

      setTimeSlots(filteredSlots);
      setLoadingTimeSlots(false);
    };

    void loadTimeSlots();
  }, [formData.locationId, formData.scheduledDate, formData.vehicleId, selectedDateHours, locations, blockedSlots]);

  useEffect(() => {
    const loadVehiclesForSlot = async () => {
      if (!formData.locationId || !formData.scheduledDate || !formData.scheduledTime) {
        setAvailableVehiclesForSlot([]);
        return;
      }

      setLoadingVehiclesForSlot(true);
      const { vehicles } = await getAvailableVehicles(
        formData.locationId,
        formData.scheduledDate,
        formData.scheduledTime,
        slotDurationMinutes
      );
      setAvailableVehiclesForSlot(vehicles || []);
      setLoadingVehiclesForSlot(false);
    };

    void loadVehiclesForSlot();
  }, [formData.locationId, formData.scheduledDate, formData.scheduledTime, slotDurationMinutes]);

  const openLocationsForDate = useMemo(() => {
    if (!formData.scheduledDate) return availableLocations;
    return availableLocations.filter((loc: any) => {
      const effectiveHours = getEffectiveHoursForDate(loc.id, formData.scheduledDate);
      return effectiveHours && !effectiveHours.is_closed;
    });
  }, [availableLocations, formData.scheduledDate, operatingHours, specialPeriods]);

  const quickLocationTotalPages = Math.max(1, Math.ceil(openLocationsForDate.length / QUICK_LOCATION_PAGE_SIZE));
  const pagedQuickLocations = useMemo(() => {
    const startIndex = quickLocationPage * QUICK_LOCATION_PAGE_SIZE;
    return openLocationsForDate.slice(startIndex, startIndex + QUICK_LOCATION_PAGE_SIZE);
  }, [openLocationsForDate, quickLocationPage]);

  useEffect(() => {
    setQuickLocationPage(0);
  }, [formData.scheduledDate, formData.selectedModel]);

  useEffect(() => {
    if (quickLocationPage > quickLocationTotalPages - 1) {
      setQuickLocationPage(Math.max(0, quickLocationTotalPages - 1));
    }
  }, [quickLocationPage, quickLocationTotalPages]);

  const quickPreviewTimeSlots = useMemo(() => {
    if (!formData.scheduledDate || openLocationsForDate.length === 0) return [] as string[];

    const slotSet = new Set<string>();

    openLocationsForDate.forEach((loc: any) => {
      const hours = getEffectiveHoursForDate(loc.id, formData.scheduledDate);
      if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return;

      const [openHour, openMinute] = hours.open_time.substring(0, 5).split(':').map(Number);
      const [closeHour, closeMinute] = hours.close_time.substring(0, 5).split(':').map(Number);
      const openTotal = (openHour * 60) + openMinute;
      const closeTotal = (closeHour * 60) + closeMinute;
      const duration = getLocationSlotDuration(loc);

      for (let mins = openTotal; mins + duration <= closeTotal; mins += duration) {
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        slotSet.add(`${hh}:${mm}`);
      }
    });

    return Array.from(slotSet)
      .sort((a, b) => {
        const [ah, am] = a.split(':').map(Number);
        const [bh, bm] = b.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      })
      .slice(0, 24);
  }, [formData.scheduledDate, openLocationsForDate, operatingHours, specialPeriods]);

  const hasOpenLocationOnSelectedDate = useMemo(() => {
    if (!formData.scheduledDate) return false;
    return openLocationsForDate.length > 0;
  }, [formData.scheduledDate, openLocationsForDate]);

  // Min date = today (current day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = today.toISOString().split('T')[0];

  // Max date = 30 days out
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const isDateUnavailable = (date: Date) => {
    const day = startOfDay(date);
    const minDay = startOfDay(today);
    const max = startOfDay(maxDate);

    if (isBefore(day, minDay) || day > max) return true;
    if (availableLocations.length === 0) return true;

    const dateStr = format(day, 'yyyy-MM-dd');
    const hasAnyOpenLocation = availableLocations.some((loc: any) => {
      const effectiveHours = getEffectiveHoursForDate(loc.id, dateStr);
      return !!effectiveHours && !effectiveHours.is_closed;
    });

    return !hasAnyOpenLocation;
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!formData.selectedModel;
      case 1: return !!formData.scheduledDate && hasOpenLocationOnSelectedDate;
      case 2: return !!formData.locationId && !!formData.vehicleId;
      case 3: return !!formData.scheduledTime;
      case 4: return !!formData.fullName && !!formData.phone;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setErrors({});
    const result = bookingSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => { fieldErrors[err.path[0] as string] = err.message; });
      setErrors(fieldErrors);
      return;
    }
    if (formData.preferredContact === 'email' && !formData.email) {
      setErrors({ email: 'Email is required when preferred contact is email' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: existingCustomer } = await supabase
        .from('customers').select('id').eq('phone', formData.phone).maybeSingle();

      let customerId: string;
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await supabase.from('customers').update({
          full_name: formData.fullName,
          email: formData.email || null,
          preferred_contact: formData.preferredContact,
        }).eq('id', customerId);
      } else {
        const { data: newCustomer, error } = await supabase.from('customers').insert({
          full_name: formData.fullName,
          email: formData.email || null,
          phone: formData.phone,
          preferred_contact: formData.preferredContact,
        }).select('id').single();
        if (error) throw error;
        customerId = newCustomer.id;
      }

      const { data: tdData, error: tdError } = await supabase.from('test_drives').insert({
        customer_id: customerId,
        vehicle_id: formData.vehicleId,
        location_id: formData.locationId,
        scheduled_date: formData.scheduledDate,
        scheduled_time: formData.scheduledTime,
        slot_duration_minutes: slotDurationMinutes,
        source: 'online',
      }).select('id').single();
      if (tdError) throw tdError;

      const displayVehicle = vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle;
      const vehicleName = displayVehicle ? `${displayVehicle.brand} ${displayVehicle.model} ${displayVehicle.variant || ''}`.trim() : 'your selected vehicle';
      const locationName = selectedLocation?.name || 'our showroom';

      // Always send WhatsApp confirmation
      const confirmationMsg = `✅ *Test Drive Confirmed!*\n\nHi ${formData.fullName},\n\nYour test drive has been booked:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n📅 *Date:* ${formData.scheduledDate}\n⏰ *Time:* ${formData.scheduledTime}\n\nPlease bring a valid driving license. See you there!\n\n— Omni Tracely`;
      supabase.functions.invoke('send-whatsapp', {
        body: { to: formData.phone, message: confirmationMsg, customerId, testDriveId: tdData.id, purpose: 'booking_confirmed' },
      }).catch(err => console.error('WhatsApp send failed:', err));

      // Also send email if email is provided
      if (formData.email) {
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-confirmation',
            recipientEmail: formData.email,
            idempotencyKey: `booking-confirm-${tdData.id}`,
            templateData: { customerName: formData.fullName, vehicleName, locationName, scheduledDate: formData.scheduledDate, scheduledTime: formData.scheduledTime },
          },
        }).catch(err => console.error('Email send failed:', err));
      }

      setSuccess(true);
      toast({ title: 'Test drive booked!', description: 'You will receive a WhatsApp confirmation shortly.' + (formData.email ? ' An email confirmation has also been sent.' : '') });
    } catch (err: any) {
      toast({ title: 'Booking failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHomeStyleHeader = () => (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-primary/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-30%] right-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent/6 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] w-[200px] md:w-[300px] h-[200px] md:h-[300px] bg-info/5 rounded-full blur-[80px]" />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-2 flex items-center justify-between">
      <a href="/" >
        <div className="flex items-center justify-center py-1">
          <img src="https://res.cloudinary.com/totalesworld/image/upload/v1774814506/01492d46-e50d-452e-a7b6-4987c301a6bf_2_nanetp.png" alt="Logo" className="h-[50px] w-full" />
        </div>
        </a>

        <div className="hidden lg:flex items-center gap-3">
          <Link to="/compare">
            <Button size="lg" className="bg-info text-info-foreground rounded-xl font-semibold hover:bg-info/90 transition-all px-5">
              <Car className="mr-2 h-4 w-4" /> Compare
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" className="primary text-white rounded-xl font-semibold shadow-lg hover:bg-primary-foreground/90 hover:text-black transition-all px-5">
              Staff Login →
            </Button>
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg bg-primary-foreground/10 text-primary-foreground"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="relative z-20 lg:hidden px-4 pb-4 space-y-2">
          <Link to="/compare" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-info text-info-foreground rounded-xl font-semibold hover:bg-info/90 justify-start gap-2 h-11">
              <Car className="h-4 w-4" /> Compare Vehicles
            </Button>
          </Link>
          <Link to="/book" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full gradient-accent border-0 text-accent-foreground rounded-xl font-semibold justify-start gap-2 h-11 mt-2">
              🚗 Book Test Drive
            </Button>
          </Link>
          <Link to="/dealer-onboarding" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-success text-success-foreground rounded-xl font-semibold hover:bg-success/90 justify-start gap-2 h-11 mt-2">
              <Building2 className="h-4 w-4" /> For Dealers
            </Button>
          </Link>
          <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-primary-foreground text-foreground rounded-xl font-semibold justify-start gap-2 h-11 mt-2">
              Staff Login →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );

  if (success) {
    return (
      <div className="min-h-screen bg-background">
        {renderHomeStyleHeader()}
        <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
          <Card className="w-full shadow-elevated animate-fade-in text-center">
            <CardContent className="p-8">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Test Drive Booked!</h2>
              <p className="text-muted-foreground mb-2">Thank you for booking with Omni Tracely.</p>
              <p className="text-sm text-muted-foreground mb-6">We have sent your confirmation and below is your complete journey flow.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => { setSuccess(false); setStep(0); setFormData({ fullName: '', email: '', phone: '', preferredContact: 'phone', locationId: '', vehicleId: '', scheduledDate: '', scheduledTime: '', selectedModel: '', selectedVariantVehicleId: '' }); }}>
                  Book Another
                </Button>
                <Link to="/">
                  <Button variant="outline" className="w-full sm:w-auto">Back to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-blue-50/60 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg">Your Test Drive Journey Steps</CardTitle>
              <CardDescription>
                Keep this as your checklist when you visit the showroom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {JOURNEY_PREVIEW_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="rounded-xl border border-primary/20 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {step.id}
                        </span>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-dashed border-primary/30">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Need help before your visit? Contact your assigned sales team from the confirmation message and they will guide you.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {renderHomeStyleHeader()}

      {/* Step Indicator */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive ? 'bg-primary text-primary-foreground shadow-md' :
                    isDone ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12 pt-4">
        <Card className="shadow-elevated animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-lg">
              {step === 0 && 'Choose Your Vehicle'}
              {step === 1 && 'Select a Date'}
              {step === 2 && 'Pick a Location'}
              {step === 3 && 'Choose a Time Slot'}
              {step === 4 && 'Your Information'}
            </CardTitle>
            <CardDescription>
              {step === 0 && 'Browse available models and select one to test drive'}
              {step === 1 && 'Pick a date and quickly choose location and time directly from the calendar view'}
              {step === 2 && 'Select the showroom nearest to you'}
              {step === 3 && 'Available time slots for your selected date'}
              {step === 4 && 'Fill in your contact details to confirm'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Step 0: Vehicle Selection */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Vehicle Category</Label>
                    <Select
                      value={vehicleCategoryFilter}
                      onValueChange={(v: 'new' | 'used') => {
                        setVehicleCategoryFilter(v);
                        setFormData((p) => ({ ...p, selectedModel: '', selectedVariantVehicleId: '', vehicleId: '', locationId: '', scheduledTime: '' }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New Cars</SelectItem>
                        <SelectItem value="used">Used Cars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Wheel Segment</Label>
                    <Select
                      value={vehicleSegmentFilter}
                      onValueChange={(v: 'all' | 'four_wheeler' | 'two_wheeler') => {
                        setVehicleSegmentFilter(v);
                        setFormData((p) => ({ ...p, selectedModel: '', selectedVariantVehicleId: '', vehicleId: '', locationId: '', scheduledTime: '' }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                        <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Compare button */}
                {compareIds.length >= 2 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <span className="text-sm text-foreground font-medium">
                      <GitCompareArrows className="h-4 w-4 inline mr-1.5" />
                      {compareIds.length} vehicles selected for comparison
                    </span>
                    <Link to={`/compare?ids=${compareIds.join(',')}`}>
                      <Button size="sm" className="gradient-primary border-0 text-primary-foreground text-xs">
                        Compare Now
                      </Button>
                    </Link>
                  </div>
                )}
                {modelGroups.ev.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Zap className="h-4 w-4 text-success" />
                      <span className="text-sm font-semibold text-success">Electric Vehicles</span>
                    </div>
                    <div className="grid gap-3">
                      {modelGroups.ev.map(m => (
                        <ModelCard key={`${m.brand}|${m.model}`} model={m} selected={selectedModelKey === `${m.brand}|${m.model}`}
                          compareIds={compareIds} onToggleCompare={(id) => setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 4 ? [...prev, id] : prev)}
                          onClick={() => handleModelSelect(`${m.brand}|${m.model}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {modelGroups.hybrid.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm font-semibold text-info">🔄 Hybrid Vehicles</span>
                    </div>
                    <div className="grid gap-3">
                      {modelGroups.hybrid.map(m => (
                        <ModelCard key={`${m.brand}|${m.model}`} model={m} selected={selectedModelKey === `${m.brand}|${m.model}`}
                          compareIds={compareIds} onToggleCompare={(id) => setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 4 ? [...prev, id] : prev)}
                          onClick={() => handleModelSelect(`${m.brand}|${m.model}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {modelGroups.ice.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm font-semibold text-muted-foreground">🏎️ Petrol / Diesel</span>
                    </div>
                    <div className="grid gap-3">
                      {modelGroups.ice.map(m => (
                        <ModelCard key={`${m.brand}|${m.model}`} model={m} selected={selectedModelKey === `${m.brand}|${m.model}`}
                          compareIds={compareIds} onToggleCompare={(id) => setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 4 ? [...prev, id] : prev)}
                          onClick={() => handleModelSelect(`${m.brand}|${m.model}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {sampleVehicle && (
                  <div className="pt-2">
                    <VehicleSpecCard vehicle={sampleVehicle} />
                  </div>
                )}
              </div>
            )}

            

            {/* Step 2: Location & Variant Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Preferred Date</Label>
                  <div className="rounded-xl border border-border bg-card p-2">
                    <Calendar
                      mode="single"
                      selected={formData.scheduledDate ? new Date(`${formData.scheduledDate}T00:00:00`) : undefined}
                      onSelect={(d) => {
                        if (!d) return;
                        setFormData((p) => ({
                          ...p,
                          scheduledDate: format(d, 'yyyy-MM-dd'),
                          scheduledTime: '',
                          locationId: '',
                          vehicleId: '',
                          selectedVariantVehicleId: '',
                        }));
                      }}
                      disabled={isDateUnavailable}
                      className="p-3 pointer-events-auto"
                    />
                  </div>
                </div>

                {openLocationsForDate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No locations have this model available. Try a different model.</p>
                ) : (
                  <>
                    <div className="grid gap-3">
                      {openLocationsForDate.map(loc => {
                        const isSelected = formData.locationId === loc.id;
                        const locVehicles = modelVehicles.filter(v => v.location_id === loc.id);
                        const hours = getEffectiveHoursForDate(loc.id, formData.scheduledDate);
                        const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(loc.address + ' ' + loc.city)}`;

                        return (
                          <button key={loc.id} type="button"
                            onClick={() => {
                              const firstVehicle = locVehicles[0];
                              if (!firstVehicle) {
                                setFormData(p => ({ ...p, locationId: loc.id, vehicleId: '', selectedVariantVehicleId: '' }));
                                return;
                              }

                              if (vehicleCategoryFilter === 'used') {
                                setFormData(p => ({ ...p, locationId: loc.id, vehicleId: firstVehicle.id, selectedVariantVehicleId: firstVehicle.id }));
                                return;
                              }

                              const demoVehicle = getDemoVehicleForVariantAtLocation(firstVehicle.id, loc.id);
                              setFormData(p => ({
                                ...p,
                                locationId: loc.id,
                                selectedVariantVehicleId: firstVehicle.id,
                                vehicleId: demoVehicle?.id || '',
                              }));
                            }}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                              isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/30 bg-card'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-foreground">{loc.name}</p>
                                <p className="text-xs text-muted-foreground">{loc.address}, {loc.city}</p>
                                <div className="mt-1.5 space-y-1">
                                  <p className="text-[11px] text-muted-foreground">
                                    Dealer: <span className="font-medium text-foreground">{dealerNamesById[loc.dealer_id] || 'Unknown'}</span>
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Brands: <span className="font-medium text-foreground">{(brandsByDealerId[loc.dealer_id] || []).join(', ') || 'No brands mapped'}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hours && (
                                  <span className="text-xs text-muted-foreground">
                                    {hours.open_time?.substring(0, 5)} - {hours.close_time?.substring(0, 5)}
                                  </span>
                                )}
                                <Badge variant="secondary" className="text-[10px]">
                                  Slot: {getLocationSlotDuration(loc)}m
                                </Badge>
                                {hours?.source === 'special' && hours?.source_name && (
                                  <Badge variant="outline" className="text-[10px]">{hours.source_name}</Badge>
                                )}
                                <a
                                  href={mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                                  title="View on Google Maps"
                                >
                                  <MapIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </a>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-border space-y-3">
                                <a
                                  href={mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs text-primary hover:underline font-medium"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View Full Map
                                </a>
                                {locVehicles.length > 0 && (
                                  <div>
                                    <Label className="text-xs mb-2 block">Choose Variant / Color</Label>
                                    <div className="grid gap-2">
                                      {locVehicles.map(v => (
                                        <button key={v.id} type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (vehicleCategoryFilter === 'used') {
                                              setFormData(p => ({ ...p, selectedVariantVehicleId: v.id, vehicleId: v.id }));
                                              return;
                                            }
                                            const demoVehicle = getDemoVehicleForVariantAtLocation(v.id, loc.id);
                                            setFormData(p => ({ ...p, selectedVariantVehicleId: v.id, vehicleId: demoVehicle?.id || '' }));
                                          }}
                                          className={`text-left text-sm p-2.5 rounded-lg border transition-all ${
                                            formData.selectedVariantVehicleId === v.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'
                                          }`}
                                        >
                                          {v.variant || v.model} {v.color ? `· ${v.color}` : ''} {v.year}
                                          {vehicleCategoryFilter === 'new' && (
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                              {getDemoVehicleForVariantAtLocation(v.id, loc.id) ? 'Demo available' : 'No demo linked'}
                                            </p>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {vehicleCategoryFilter === 'new' && !formData.vehicleId && (
                                  <p className="text-xs text-destructive">No demo vehicle linked to the selected variant at this location.</p>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedVehicle && <VehicleSpecCard vehicle={selectedVehicle} />}
                  </>
                )}
              </div>
            )}

            {/* Step 3: Time Selection */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Preferred Date</Label>
                  <div className="rounded-xl border border-border bg-card p-2">
                    <Calendar
                      mode="single"
                      selected={formData.scheduledDate ? new Date(`${formData.scheduledDate}T00:00:00`) : undefined}
                      onSelect={(d) => {
                        if (!d) return;
                        setFormData((p) => ({
                          ...p,
                          scheduledDate: format(d, 'yyyy-MM-dd'),
                          scheduledTime: '',
                          locationId: '',
                          vehicleId: '',
                          selectedVariantVehicleId: '',
                        }));
                        setStep(2);
                      }}
                      disabled={isDateUnavailable}
                      className="p-3 pointer-events-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Changing date reloads locations and slot availability.
                  </p>
                </div>

                {formData.scheduledDate && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {new Date(`${formData.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                    {selectedDateHours && !selectedDateHours.is_closed && (
                      <p className="text-xs text-muted-foreground">
                        Available window: {selectedDateHours.open_time?.substring(0, 5)} - {selectedDateHours.close_time?.substring(0, 5)}
                        {selectedDateHours.source === 'special' && selectedDateHours.source_name
                          ? ` (${selectedDateHours.source_name})`
                          : ''}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Slot duration: {slotDurationMinutes} minutes</p>
                  </div>
                )}
                {selectedDateHours?.is_closed ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      This location is closed on the selected day
                      {selectedDateHours?.source_name ? ` (${selectedDateHours.source_name})` : ''}.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>Change Date</Button>
                  </div>
                ) : loadingTimeSlots ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading available slots...</p>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No available time slots for this vehicle on this date.</p>
                    <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>Change Date</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map(slot => {
                      const isSelected = formData.scheduledTime === slot.startTime;
                      const [h] = slot.startTime.split(':').map(Number);
                      const period = h < 12 ? 'AM' : 'PM';
                      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      const displayTime = `${displayH}:${slot.startTime.split(':')[1]} ${period}`;
                      return (
                        <button key={slot.startTime} type="button"
                          onClick={() => setFormData(p => ({ ...p, scheduledTime: slot.startTime }))}
                          className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                            isSelected ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                          }`}
                        >
                          {displayTime}
                          <span className="block text-[10px] opacity-80">until {slot.endTime}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {formData.scheduledTime && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-foreground mb-2">Vehicle availability for selected slot</p>
                    {loadingVehiclesForSlot ? (
                      <p className="text-xs text-muted-foreground">Checking available vehicles...</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {(availableVehiclesForSlot || []).filter((v: any) => v.availableForSlot).length} vehicles available at this location.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(availableVehiclesForSlot || [])
                            .filter((v: any) => {
                              if (!v.availableForSlot) return false;
                              if (vehicleCategoryFilter === 'used') {
                                return !!v.is_used && `${v.brand}|${v.model}` === selectedModelKey;
                              }
                              return isDemoMatchForSelectedVariant(v);
                            })
                            .slice(0, 4)
                            .map((v: any) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setFormData((p) => ({ ...p, vehicleId: v.id }))}
                                className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                                  formData.vehicleId === v.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                                }`}
                              >
                                <p className="font-medium text-foreground">{v.brand} {v.model}</p>
                                <p className="text-muted-foreground">{v.variant || 'Standard'} {v.year ? `· ${v.year}` : ''}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{v.is_demo ? 'Demo' : v.is_used ? 'Used' : 'New'}</Badge>
                                  {v.set_price != null && <Badge variant="secondary" className="text-[10px]">Rs {Number(v.set_price).toLocaleString()}</Badge>}
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Personal Info */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input id="fullName" value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} placeholder="Your full name" />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input id="phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Contact</Label>
                    <Select value={formData.preferredContact} onValueChange={v => setFormData(p => ({ ...p, preferredContact: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">📞 Phone</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                        <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Booking Summary */}
                <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Booking Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium text-foreground">{(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle) ? `${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.brand} ${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.model}` : '—'}</span></div>
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-medium text-foreground">{formData.scheduledDate || '—'}</span></div>
                    <div><span className="text-muted-foreground">Location:</span> <span className="font-medium text-foreground">{selectedLocation?.name || '—'}</span></div>
                    <div><span className="text-muted-foreground">Time:</span> <span className="font-medium text-foreground">{formData.scheduledTime || '—'}</span></div>
                    <div><span className="text-muted-foreground">Dealer:</span> <span className="font-medium text-foreground">{selectedLocation ? dealerNamesById[selectedLocation.dealer_id] || 'Unknown' : '—'}</span></div>
                    <div><span className="text-muted-foreground">Brands:</span> <span className="font-medium text-foreground">{selectedLocation ? (brandsByDealerId[selectedLocation.dealer_id] || []).join(', ') || 'No brands mapped' : '—'}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => step === 0 ? window.history.back() : setStep(s => s - 1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {step === 0 ? 'Home' : 'Back'}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gradient-primary border-0 text-primary-foreground gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !canProceed()} className="gradient-primary border-0 text-primary-foreground gap-2" size="lg">
                  {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Model selection card
const ModelCard = ({ model, selected, onClick, compareIds = [], onToggleCompare }: { model: any; selected: boolean; onClick: () => void; compareIds?: string[]; onToggleCompare?: (id: string) => void }) => {
  const sample = model.vehicles[0];
  const isEV = model.engine_type === 'electric';
  const vehicleId = sample?.id;
  const isInCompare = vehicleId && compareIds.includes(vehicleId);
  return (
    <div className="relative">
      <button type="button" onClick={onClick}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
          selected ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/30 bg-card'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">{model.brand} {model.model}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sample?.variant || ''} · {sample?.year}
              {isEV && sample?.range_km ? ` · ${sample.range_km}km range` : ''}
              {!isEV && sample?.mileage ? ` · ${sample.mileage}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{sample?.is_used ? 'Used' : 'New'}</Badge>
              {sample?.set_price != null && <Badge variant="secondary" className="text-[10px]">Rs {Number(sample.set_price).toLocaleString()}</Badge>}
              {sample?.vehicle_time_days != null && <Badge variant="secondary" className="text-[10px]">{sample.vehicle_time_days} day(s)</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-[10px] ${sample?.available_units > 0 ? '' : 'bg-destructive/10 text-destructive'}`}>
              {sample?.available_units > 0 ? `${sample.available_units}/${sample.total_units} avail` : 'Booked'}
            </Badge>
            {selected && <CheckCircle className="h-5 w-5 text-primary" />}
          </div>
        </div>
        {sample?.horsepower && (
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>{sample.horsepower} HP</span>
            {sample.acceleration && <span>{sample.acceleration}</span>}
            {sample.transmission && <span>{sample.transmission}</span>}
          </div>
        )}
      </button>
      {onToggleCompare && vehicleId && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleCompare(vehicleId); }}
          className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
            isInCompare ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {isInCompare ? '✓ Compare' : '+ Compare'}
        </button>
      )}
    </div>
  );
};

export default BookingPage;
