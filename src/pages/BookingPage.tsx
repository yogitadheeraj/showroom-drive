import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import VehicleSpecCard from '@/components/booking/VehicleSpecCard';
import { Car, CheckCircle, Zap, ArrowLeft, ArrowRight, MapPin, Clock, User, ChevronRight, Shield, GitCompareArrows, Map as MapIcon, ExternalLink, CalendarIcon } from 'lucide-react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { checkAndReleaseNoShowBookings, getAvailableTimeSlots, getAvailableVehicles } from '@/lib/slotAvailability';

const STEPS = [
  { id: 'vehicle', label: 'Vehicle', icon: Car },
  { id: 'date', label: 'Date', icon: Clock },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'info', label: 'Your Info', icon: User },
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

const BookingPage = () => {
  const [searchParams] = useSearchParams();
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
    selectedModel: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [availableVehiclesForSlot, setAvailableVehiclesForSlot] = useState<any[]>([]);
  const [loadingVehiclesForSlot, setLoadingVehiclesForSlot] = useState(false);
  const { toast } = useToast();

  // Auto-select vehicle from URL (coming from compare page)
  useEffect(() => {
    const vehicleId = searchParams.get('vehicleId');
    if (vehicleId && allVehicles.length > 0) {
      const v = allVehicles.find(veh => veh.id === vehicleId);
      if (v) {
        setFormData(prev => ({
          ...prev,
          selectedModel: `${v.brand}|${v.model}`,
          vehicleId: v.id,
          locationId: v.location_id,
        }));
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
      setLocations(lRes.data || []);
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

  // Unique models grouped by type
  const modelGroups = useMemo(() => {
    const modelMap = new Map<string, { brand: string; model: string; engine_type: string; vehicles: any[] }>();
    allVehicles.forEach(v => {
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
  }, [allVehicles]);

  const selectedModelKey = formData.selectedModel;
  const modelVehicles = useMemo(() => {
    if (!selectedModelKey) return [];
    return allVehicles.filter(v => `${v.brand}|${v.model}` === selectedModelKey);
  }, [selectedModelKey, allVehicles]);

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

      const vehicleName = selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'your selected vehicle';
      const locationName = selectedLocation?.name || 'our showroom';

      // Always send WhatsApp confirmation
      const confirmationMsg = `✅ *Test Drive Confirmed!*\n\nHi ${formData.fullName},\n\nYour test drive has been booked:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n📅 *Date:* ${formData.scheduledDate}\n⏰ *Time:* ${formData.scheduledTime}\n\nPlease bring a valid driving license. See you there!\n\n— TestDriveSync`;
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elevated animate-fade-in text-center">
          <CardContent className="p-8">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-2">Test Drive Booked!</h2>
            <p className="text-muted-foreground mb-6">We'll send you a confirmation shortly.</p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => { setSuccess(false); setStep(0); setFormData({ fullName: '', email: '', phone: '', preferredContact: 'phone', locationId: '', vehicleId: '', scheduledDate: '', scheduledTime: '', selectedModel: '' }); }}>
                Book Another
              </Button>
              <Link to="/">
                <Button variant="outline" className="w-full">Back to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-dark py-6 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Home</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-heading font-bold text-primary-foreground">TestDriveSync</h1>
          </div>
          <Link to="/auth" className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Staff</span>
          </Link>
        </div>
      </div>

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
              {step === 1 && 'When would you like to visit?'}
              {step === 2 && 'Select the showroom nearest to you'}
              {step === 3 && 'Available time slots for your selected date'}
              {step === 4 && 'Fill in your contact details to confirm'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Step 0: Vehicle Selection */}
            {step === 0 && (
              <div className="space-y-4">
                {/* Compare button */}
                {compareIds.length >= 2 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <span className="text-sm text-foreground font-medium">
                      <GitCompareArrows className="h-4 w-4 inline mr-1.5" />
                      {compareIds.length} vehicles selected for comparison
                    </span>
                    <RouterLink to={`/compare?ids=${compareIds.join(',')}`}>
                      <Button size="sm" className="gradient-primary border-0 text-primary-foreground text-xs">
                        Compare Now
                      </Button>
                    </RouterLink>
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
                          onClick={() => setFormData(p => ({ ...p, selectedModel: `${m.brand}|${m.model}`, vehicleId: '', locationId: '' }))} />
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
                          onClick={() => setFormData(p => ({ ...p, selectedModel: `${m.brand}|${m.model}`, vehicleId: '', locationId: '' }))} />
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
                          onClick={() => setFormData(p => ({ ...p, selectedModel: `${m.brand}|${m.model}`, vehicleId: '', locationId: '' }))} />
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

            {/* Step 1: Date Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred Date</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal text-base',
                          !formData.scheduledDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.scheduledDate
                          ? format(new Date(`${formData.scheduledDate}T00:00:00`), 'PPP')
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.scheduledDate ? new Date(`${formData.scheduledDate}T00:00:00`) : undefined}
                        onSelect={(d) => {
                          if (!d) return;
                          setFormData(p => ({
                            ...p,
                            scheduledDate: format(d, 'yyyy-MM-dd'),
                            scheduledTime: '',
                            locationId: '',
                            vehicleId: '',
                          }));
                          setDatePickerOpen(false);
                        }}
                        disabled={isDateUnavailable}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Dates are enabled only when at least one location is open (including special schedules).
                  </p>
                </div>
                {formData.scheduledDate && (
                  <p className="text-sm text-muted-foreground">
                    📅 Selected: <span className="font-medium text-foreground">
                      {new Date(formData.scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </p>
                )}
                {formData.scheduledDate && !hasOpenLocationOnSelectedDate && (
                  <p className="text-sm text-destructive">
                    All locations are closed on this date. Please choose another date.
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Location & Variant Selection */}
            {step === 2 && (
              <div className="space-y-4">
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
                              setFormData(p => ({ ...p, locationId: loc.id, vehicleId: firstVehicle?.id || '' }));
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
                                {locVehicles.length > 1 && (
                                  <div>
                                    <Label className="text-xs mb-2 block">Choose Variant / Color</Label>
                                    <div className="grid gap-2">
                                      {locVehicles.map(v => (
                                        <button key={v.id} type="button"
                                          onClick={(e) => { e.stopPropagation(); setFormData(p => ({ ...p, vehicleId: v.id })); }}
                                          className={`text-left text-sm p-2.5 rounded-lg border transition-all ${
                                            formData.vehicleId === v.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'
                                          }`}
                                        >
                                          {v.variant || v.model} {v.color ? `· ${v.color}` : ''} {v.year}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
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
                            .filter((v: any) => v.availableForSlot && `${v.brand}|${v.model}` === selectedModelKey)
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
                    <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium text-foreground">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : '—'}</span></div>
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
