import { useEffect, useMemo, useState } from 'react';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import {
  cancelServiceBooking,
  createServiceBooking,
  getServiceAvailability,
  listServicePackages,
  lookupServiceBookings,
  requestServiceBookingOtp,
  rescheduleServiceBooking,
  verifyServiceBookingOtp,
  type ServicePackage,
} from '@/lib/serviceBookingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';
import { getPreferredContactValues, normalizePreferredContactSelection } from '@/lib/serviceBookingService';

const CONTACT_OPTIONS = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;

const CURRENCY_LOCALE_BY_CODE: Record<string, string> = {
  AED: 'en-AE',
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

const resolveCurrencyCode = (currency?: string | null) => {
  const normalized = (currency || 'AED').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CURRENCY_LOCALE_BY_CODE, normalized) ? normalized : 'AED';
};

const formatCurrencyValue = (value: number, currencyCode?: string | null) => {
  const code = resolveCurrencyCode(currencyCode);
  const locale = CURRENCY_LOCALE_BY_CODE[code] || 'en-AE';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
};

const defaultForm = {
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  preferred_contact: 'phone',
  location_id: '',
  package_code: '',
  appointment_date: '',
  appointment_time: '',
  vehicle_registration_number: '',
  vehicle_brand: '',
  vehicle_model: '',
  vehicle_variant: '',
  vehicle_year: '',
  vehicle_color: '',
};

export default function ServiceBookingPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [existingVehicles, setExistingVehicles] = useState<any[]>([]);
  const [pastBookings, setPastBookings] = useState<any[]>([]);
  const [locationCurrencyCode, setLocationCurrencyCode] = useState('AED');
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, { date: string; time: string }>>({});
  const [existingCustomer, setExistingCustomer] = useState<any | null>(null);
  const [lookupCustomerLoading, setLookupCustomerLoading] = useState(false);
  const [availableServiceSlots, setAvailableServiceSlots] = useState<Array<{ time: string; available_units: number; is_available: boolean }>>([]);
  const [loadingServiceSlots, setLoadingServiceSlots] = useState(false);
  const [showEarliestSlotDialog, setShowEarliestSlotDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { id: 'verify', label: 'Verify', description: 'Mobile confirmation' },
    { id: 'details', label: 'Details', description: 'Appointment info' },
    { id: 'review', label: 'Review', description: 'Confirm & submit' },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pkgRows, locRows] = await Promise.all([
          listServicePackages(),
          apiDbQuery<any[]>({
            table: 'locations',
            action: 'select',
            select: '*',
            filters: [{ field: 'is_active', op: 'eq', value: true }],
          }),
        ]);

        setPackages(pkgRows || []);
        setLocations(locRows || []);
        const fallbackLocation = (locRows || [])[0];
        const activeCurrency = resolveCurrencyCode(fallbackLocation?.currency_type || 'AED');
        setLocationCurrencyCode(activeCurrency);
        if ((pkgRows || []).length > 0) {
          setForm((prev) => ({ ...prev, package_code: pkgRows[0].code }));
        }
      } catch (error: any) {
        toast({
          title: 'Unable to load booking data',
          description: error?.message || 'Please refresh the page.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [toast]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.code === form.package_code) || null,
    [form.package_code, packages],
  );

  const getPhonePlaceholder = (value: string) => {
    const typedPrefix = value.trim().match(/^\+\d{1,3}/)?.[0];
    const countryFromValue = typedPrefix ? COUNTRIES.find((country) => country.dialCode === typedPrefix) : undefined;
    const localeCountryCode = Intl.DateTimeFormat().resolvedOptions().locale?.split('-')[1]?.toUpperCase();
    const countryFromLocale = localeCountryCode ? COUNTRIES.find((country) => country.code === localeCountryCode) : undefined;
    const country = countryFromValue || countryFromLocale || COUNTRIES.find((item) => item.name === 'India') || COUNTRIES[0];
    const examples: Record<string, string> = {
      IN: '+91 98765 43210',
      US: '+1 555 123 4567',
      GB: '+44 7700 900123',
      AE: '+971 50 123 4567',
      SG: '+65 9123 4567',
      AU: '+61 412 345 678',
      DE: '+49 151 23456789',
      FR: '+33 6 12 34 56 78',
    };

    return examples[country.code] || `${country.dialCode} 98765 43210`;
  };

  const validateEmailFormat = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handlePhoneChange = (value: string) => {
    setForm((prev) => ({ ...prev, customer_phone: value, customer_email: '', preferred_contact: 'phone', first_name: '', last_name: '' }));
    if (isPhoneVerified) {
      setIsPhoneVerified(false);
      setVerificationToken('');
      setOtpRequested(false);
      setOtpCode('');
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'location_id') {
        const chosenLocation = locations.find((location) => location.id === value);
        setLocationCurrencyCode(resolveCurrencyCode(chosenLocation?.currency_type || 'AED'));
      }
      return next;
    });
  };

  const runCustomerLookup = async (nextPhoneOverride?: string, nextEmailOverride?: string) => {
    const nextPhone = (nextPhoneOverride ?? form.customer_phone).trim();
    const nextEmail = (nextEmailOverride ?? form.customer_email).trim();

    if (!nextPhone && !nextEmail) {
      setExistingCustomer(null);
      return null;
    }

    try {
      setLookupCustomerLoading(true);
      const queries: Promise<any>[] = [];

      if (nextPhone) {
        queries.push(apiGet<any[]>(`/api/customers?phone=${encodeURIComponent(nextPhone)}&limit=1`));
      }

      if (nextEmail) {
        queries.push(apiGet<any[]>(`/api/customers?email=${encodeURIComponent(nextEmail.toLowerCase())}&limit=1`));
      }

      const results = await Promise.all(queries);
      const matched = (results.flat() as any[]).find(Boolean);
      if (!matched) {
        setExistingCustomer(null);
               toast({ title: 'No customer found', description: 'No existing customer matched the provided phone or email', variant: 'destructive', duration: 2000 });
 
        return null;
      }
      setExistingCustomer(matched);

      if (matched) {
        setForm((prev) => ({
          ...prev,
          customer_name: prev.customer_name || matched.full_name || '',
          customer_email: prev.customer_email || matched.email || '',
          preferred_contact: prev.preferred_contact && prev.preferred_contact !== 'phone' ? prev.preferred_contact : (matched.preferred_contact || 'phone'),
        }));
      }

      return matched || null;
    } catch {
      setExistingCustomer(null);
      return null;
    } finally {
      setLookupCustomerLoading(false);
    }
  };

  const selectedPreferredContacts = useMemo(
    () => getPreferredContactValues(form.preferred_contact),
    [form.preferred_contact],
  );

  const togglePreferredContact = (contact: string) => {
    const nextSelection = new Set(selectedPreferredContacts);
    if (nextSelection.has(contact)) {
      nextSelection.delete(contact);
    } else {
      nextSelection.add(contact);
    }

    const value = normalizePreferredContactSelection(Array.from(nextSelection));
    setForm((prev) => ({ ...prev, preferred_contact: value }));
  };

  const populateCustomerProfile = (profile: any, vehicles: any[] = [], bookings: any[] = []) => {
    if (profile?.name) {
      setForm((prev) => ({ ...prev, customer_name: prev.customer_name || profile.name || '' }));
    }

    if (profile?.email) {
      setForm((prev) => ({ ...prev, customer_email: prev.customer_email || profile.email || '' }));
    }

    if (vehicles?.length) {
      const firstVehicle = vehicles[0];
      setExistingVehicles(vehicles);
      setForm((prev) => ({
        ...prev,
        vehicle_registration_number: prev.vehicle_registration_number || firstVehicle.registration_number || '',
        vehicle_brand: prev.vehicle_brand || firstVehicle.brand || '',
        vehicle_model: prev.vehicle_model || firstVehicle.model || '',
        vehicle_variant: prev.vehicle_variant || firstVehicle.variant || '',
        vehicle_year: prev.vehicle_year || (firstVehicle.year ? String(firstVehicle.year) : ''),
        vehicle_color: prev.vehicle_color || firstVehicle.color || '',
      }));
    } else {
      setExistingVehicles([]);
    }

    setPastBookings(bookings || []);
  };

  const loadExistingCustomerData = async (phone: string, token: string) => {
    if (!phone || !token) return;

    setLookupLoading(true);
    try {
      const result = await lookupServiceBookings(phone, token);
      const vehicles = result?.vehicles || [];
      const bookings = result?.bookings || [];
      const profile = result?.customer || null;

      populateCustomerProfile(profile, vehicles, bookings);
    } catch (error: any) {
      toast({
        title: 'Unable to fetch past details',
        description: error?.message || 'We could not load this customer’s previous vehicle or booking details.',
        variant: 'destructive',
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!form.customer_phone.trim()) {
      toast({ title: 'Phone number is required', variant: 'destructive' });
      return;
    }

    const emailToUse = (form.customer_email || existingCustomer?.email || '').trim();
    if (!emailToUse) {
      toast({
        title: 'Email required to continue',
        description: 'Please add your email so we can send the OTP and continue the booking smoothly.',
        variant: 'destructive',
      });
      setActiveStep(1);
      return;
    }

    if (!validateEmailFormat(emailToUse)) {
      toast({
        title: 'Invalid email format',
        description: 'Please enter a valid email address before sending the OTP.',
        variant: 'destructive',
      });
      setActiveStep(1);
      return;
    }

    setOtpLoading(true);
    try {
      setForm((prev) => ({ ...prev, customer_email: emailToUse }));
      await requestServiceBookingOtp(form.customer_phone.trim(), emailToUse);
      setOtpRequested(true);
      setOtpCode('');
      setIsPhoneVerified(false);
      toast({ title: 'OTP sent', description: `We have sent the verification code to ${emailToUse}.` });
    } catch (error: any) {
      toast({ title: 'OTP request failed', description: error?.message || 'Unable to send OTP.', variant: 'destructive' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!form.customer_phone.trim() || !otpCode.trim()) {
      toast({ title: 'Enter the OTP to continue', variant: 'destructive' });
      return;
    }

    setVerificationLoading(true);
    try {
      const result = await verifyServiceBookingOtp(form.customer_phone.trim(), otpCode.trim());
      const nextToken = result?.verification_token || '';
      setVerificationToken(nextToken);
      setIsPhoneVerified(Boolean(nextToken));

      if (!nextToken) {
        toast({ title: 'Verification failed', description: 'The OTP could not be validated.', variant: 'destructive' });
        return;
      }

      await loadExistingCustomerData(form.customer_phone.trim(), nextToken);
      setActiveStep(1);
      toast({ title: 'Phone verified', description: 'Your customer details and previous bookings have been loaded.' });
    } catch (error: any) {
      toast({ title: 'OTP verification failed', description: error?.message || 'The code you entered is invalid.', variant: 'destructive' });
    } finally {
      setVerificationLoading(false);
    }
  };

  const clearMatchedCustomerSearch = () => {
    setExistingCustomer(null);
    setForm((prev) => ({
      ...prev,
      customer_name: '',
      customer_email: '',
      preferred_contact: 'phone',
    }));
  };

  const usePastBookingDetails = (booking: any) => {
    if (!booking) return;

    const vehicle = booking.vehicle || {};
    setForm((prev) => ({
      ...prev,
      customer_name: prev.customer_name || booking.customer_name || '',
      customer_email: prev.customer_email || booking.customer_email || '',
      location_id: prev.location_id || booking.location_id || '',
      package_code: prev.package_code || booking.package_code || '',
      appointment_date: prev.appointment_date || booking.appointment_date || '',
      appointment_time: prev.appointment_time || booking.appointment_time || '',
      vehicle_registration_number: prev.vehicle_registration_number || vehicle.registration_number || '',
      vehicle_brand: prev.vehicle_brand || vehicle.brand || '',
      vehicle_model: prev.vehicle_model || vehicle.model || '',
      vehicle_variant: prev.vehicle_variant || vehicle.variant || '',
      vehicle_year: prev.vehicle_year || (vehicle.year ? String(vehicle.year) : ''),
      vehicle_color: prev.vehicle_color || vehicle.color || '',
    }));

    toast({ title: 'Booking details loaded', description: 'The selected customer and vehicle details were applied to the form.' });
  };

  const firstAvailableSlot = useMemo(
    () => availableServiceSlots[0] ?? null,
    [availableServiceSlots],
  );

  const getTodayDateValue = () => new Date().toISOString().split('T')[0];

  const getCurrentTimeValue = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getMinTimeForDate = (dateValue?: string) => {
    const today = getTodayDateValue();
    if (!dateValue || dateValue !== today) return undefined;
    return getCurrentTimeValue();
  };

  const handleAppointmentDateChange = (value: string) => {
    setForm((prev) => {
      const nextTime = value === getTodayDateValue() && prev.appointment_time && prev.appointment_time < getCurrentTimeValue() ? '' : prev.appointment_time;
      return { ...prev, appointment_date: value, appointment_time: nextTime };
    });
  };

  useEffect(() => {
    const location = locations.find((item) => item.id === form.location_id);
    const resolvedLocationDuration = Number(location?.slot_duration_minutes || 0);
    const slotDuration = resolvedLocationDuration > 0 ? resolvedLocationDuration : 30;

    if (!form.location_id || !form.appointment_date || !form.package_code) {
      setAvailableServiceSlots([]);
      setShowEarliestSlotDialog(false);
      return;
    }

    let cancelled = false;
    const loadSlots = async () => {
      try {
        setLoadingServiceSlots(true);
        const response = await getServiceAvailability(form.location_id, form.appointment_date, form.package_code);
        if (cancelled) return;

        const slots = Array.isArray(response?.slots) ? response.slots : [];
        const validSlots = slots.filter((slot) => slot.is_available);
        setAvailableServiceSlots(validSlots);

        if (form.appointment_time && !validSlots.some((slot) => slot.time === form.appointment_time && slot.is_available)) {
          setForm((prev) => ({ ...prev, appointment_time: '' }));
        }

        if (!form.appointment_time && validSlots.length > 0 && !showEarliestSlotDialog) {
          setShowEarliestSlotDialog(true);
        }
      } catch {
        if (!cancelled) {
          setAvailableServiceSlots([]);
          setShowEarliestSlotDialog(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingServiceSlots(false);
        }
      }
    };

    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, [form.location_id, form.appointment_date, form.package_code, locations, form.appointment_time]);

  const handleAppointmentTimeChange = (value: string) => {
    const today = getTodayDateValue();
    if (form.appointment_date === today && value < getCurrentTimeValue()) {
      toast({ title: 'Past time selected', description: 'Please choose a current or future time for today.', variant: 'destructive' });
      return;
    }

    setForm((prev) => ({ ...prev, appointment_time: value }));
  };

  const handleCancelBooking = async (bookingId: string, phone: string) => {
    if (!bookingId) return;

    try {
      await cancelServiceBooking(bookingId, phone, 'Cancelled by customer from booking history');
      setPastBookings((prev) =>
        prev.map((booking) =>
          (booking.id || booking._id) === bookingId ? { ...booking, status: 'cancelled' } : booking,
        ),
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('service-booking-updated'));
      }
      toast({ title: 'Booking cancelled', description: 'The appointment has been kept in history for reference and can still be modified.' });
    } catch (error: any) {
      toast({ title: 'Cancel failed', description: error?.message || 'Unable to cancel this booking.', variant: 'destructive' });
    }
  };

  const handleRescheduleBooking = async (bookingId: string, phone: string) => {
    if (!bookingId) return;
    const draft = rescheduleDrafts[bookingId];
    if (!draft?.date || !draft?.time) {
      toast({ title: 'Please select a date and time', variant: 'destructive' });
      return;
    }

    try {
      await rescheduleServiceBooking(bookingId, phone, draft.date, draft.time, 'Rescheduled by customer from booking history');

      setPastBookings((prev) =>
        prev.map((booking) =>
          (booking.id || booking._id) === bookingId
            ? { ...booking, appointment_date: draft.date, appointment_time: draft.time, status: 'rescheduled' }
            : booking,
        ),
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('service-booking-updated'));
      }
      setRescheduleBookingId(null);
      toast({ title: 'Booking rescheduled', description: 'The appointment time has been updated.' });
    } catch (error: any) {
      toast({ title: 'Reschedule failed', description: error?.message || 'Unable to update this booking.', variant: 'destructive' });
    }
  };

  const canProceedToStep = (stepIndex: number) => {
    if (stepIndex === 0) return Boolean(form.customer_phone && isPhoneVerified);
    if (stepIndex === 1) {
      return Boolean(
        form.customer_name &&
          form.location_id &&
          form.package_code &&
          form.appointment_date &&
          form.appointment_time &&
          form.vehicle_registration_number &&
          form.vehicle_brand &&
          form.vehicle_model,
      );
    }
    return true;
  };

  const goToNextStep = () => {
    if (activeStep === 0 && !canProceedToStep(0)) {
      toast({ title: 'Verify your phone number first', variant: 'destructive' });
      return;
    }

    if (activeStep === 1 && !canProceedToStep(1)) {
      toast({ title: 'Please complete the appointment details', variant: 'destructive' });
      return;
    }

    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    if (!form.customer_phone || !isPhoneVerified) {
      toast({ title: 'Please verify your phone number first', variant: 'destructive' });
      return;
    }

    const selectedContactOptions = getPreferredContactValues(form.preferred_contact);
    if (!selectedContactOptions.length) {
      toast({ title: 'Please choose a preferred contact method', variant: 'destructive' });
      return;
    }

    if (!form.customer_name || !form.location_id || !form.package_code || !form.appointment_date || !form.appointment_time || !form.vehicle_registration_number || !form.vehicle_brand || !form.vehicle_model) {
      toast({ title: 'Please complete all required fields', variant: 'destructive' });
      return;
    }

    if (form.customer_email && !validateEmailFormat(form.customer_email)) {
      toast({ title: 'Invalid email format', description: 'Please enter a valid email before confirming the booking.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await createServiceBooking({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        preferred_contact: normalizePreferredContactSelection(form.preferred_contact),
        location_id: form.location_id,
        package_code: form.package_code,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        vehicle: {
          registration_number: form.vehicle_registration_number,
          brand: form.vehicle_brand,
          model: form.vehicle_model,
          variant: form.vehicle_variant || null,
          year: form.vehicle_year ? Number(form.vehicle_year) : null,
          color: form.vehicle_color || null,
        },
      });

      setSuccessMessage('Your service booking request has been submitted. Our team will confirm the slot shortly.');
      setActiveStep(1);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('service-booking-updated'));
      }
      if (verificationToken) {
        await loadExistingCustomerData(form.customer_phone.trim(), verificationToken);
      }
      setExistingCustomer(null);
      setForm((prev) => ({
        ...prev,
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        preferred_contact: 'phone',
        vehicle_registration_number: '',
        vehicle_brand: '',
        vehicle_model: '',
        vehicle_variant: '',
        vehicle_year: '',
        vehicle_color: '',
      }));
      toast({ title: 'Service booking created', description: 'A confirmation has been sent to your contact details.' });
    } catch (error: any) {
      toast({ title: 'Booking failed', description: error?.message || 'Unable to create the service booking.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
          <Wrench className="h-4 w-4" />
          Service booking
        </p>
        <h1 className="text-3xl font-heading font-bold text-foreground">Book your service appointment</h1>
        <p className="text-sm text-muted-foreground">Verify your phone first, fetch your saved vehicle info, and review your past bookings before confirming.</p>
      </div>

      {successMessage ? (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5" />
            <span>{successMessage}</span>
          </div>
        </div>
      ) : null}

      {existingCustomer && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Existing customer found</p>
              <p className="mt-1 font-semibold text-foreground">{existingCustomer.full_name || 'Customer record'}</p>
              <p className="text-xs text-muted-foreground">{existingCustomer.phone || 'No phone'} • {existingCustomer.email || 'No email'}</p>
            </div>
            <div className="flex items-center gap-2">
              {lookupCustomerLoading ? <CircleDashed className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showEarliestSlotDialog && !!firstAvailableSlot && !form.appointment_time} onOpenChange={(open) => setShowEarliestSlotDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Earliest available slot</DialogTitle>
            <DialogDescription>
              We found the first open time for this service request. Select it instantly or choose another slot below.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.22em] text-primary/80">Recommended</div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-foreground">{firstAvailableSlot?.time || '--:--'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{form.appointment_date || 'Selected date'}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {firstAvailableSlot?.available_units || 1} unit{(firstAvailableSlot?.available_units || 1) > 1 ? 's' : ''} free
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setShowEarliestSlotDialog(false)}>
              Choose Manually
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (firstAvailableSlot?.time) {
                  handleAppointmentTimeChange(firstAvailableSlot.time);
                  setShowEarliestSlotDialog(false);
                }
              }}
            >
              Select slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const isDone = index < activeStep || (index === 0 && isPhoneVerified) || (index === 1 && canProceedToStep(1));

              return (
                <div key={step.id} className={`rounded-2xl border p-3 ${isActive ? 'border-primary bg-primary/5' : isDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activeStep === 0 ? (
            <Card className="shadow-card border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Phone className="h-5 w-5 text-primary" />
                  1. Verify mobile number
                </CardTitle>
                <CardDescription>We will send an OTP to the email linked to this phone number to confirm ownership before booking.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="customer_phone">Phone number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="customer_phone"
                        value={form.customer_phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder={getPhonePlaceholder(form.customer_phone)}
                        className="h-11 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        onClick={() => void runCustomerLookup()}
                        title="Search customer"
                        aria-label="Search customer"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                {existingCustomer ?   <div className="sm:w-[170px]">
                    <Label htmlFor="customer_phone" className="sr-only">Phone number</Label>
                    <Button
                      id="send-otp-button"
                      type="button"
                      variant="outline"
                      disabled={otpLoading || !form.customer_phone.trim()}
                      onClick={handleRequestOtp}
                      className="h-11 w-full sm:w-[170px]"
                    >
                      {otpLoading ? 'Sending...' : 'Send OTP'}
                    </Button>
                  </div>: null}
                </div>

                {otpRequested ? (
                  <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">Verification code</p>
                        <p className="text-sm text-muted-foreground">Enter the OTP received for this mobile number.</p>
                      </div>
                      {isPhoneVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="otp_code">Enter OTP</Label>
                        <Input id="otp_code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" className="font-mono tracking-[0.2em]" />
                      </div>
                      <Button type="button" onClick={handleVerifyOtp} disabled={verificationLoading || !otpCode.trim()} className="w-full sm:w-auto">
                        {verificationLoading ? 'Verifying...' : 'Verify phone'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {lookupLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CircleDashed className="h-4 w-4 animate-spin" />
                    Loading customer and booking history...
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {activeStep === 1 ? (
            <Card className="shadow-card border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  2. Appointment details
                </CardTitle>
                <CardDescription>Existing customer details are filled automatically when a matching phone number has been verified.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer name</Label>
                    <Input id="customer_name" value={form.customer_name} onChange={(e) => handleChange('customer_name', e.target.value)} placeholder="John Doe" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer_phone_summary">Phone number</Label>
                    <Input id="customer_phone_summary" value={form.customer_phone} readOnly className="bg-muted/40" />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="customer_email">Email address</Label>
                    <Input id="customer_email" type="email" value={form.customer_email} onChange={(e) => handleChange('customer_email', e.target.value)} placeholder="you@example.com" />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Preferred contact</Label>
                    <div className="flex flex-wrap gap-2">
                      {CONTACT_OPTIONS.map((option) => {
                        const selected = selectedPreferredContacts.includes(option.value);
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => togglePreferredContact(option.value)}
                            className="rounded-full"
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Choose one or more channels. Selecting all three is treated as all channels.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location_id">Location</Label>
                    <Select value={form.location_id} onValueChange={(value) => handleChange('location_id', value)}>
                      <SelectTrigger id="location_id">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="package_code">Service package</Label>
                    <Select value={form.package_code} onValueChange={(value) => handleChange('package_code', value)} disabled={loading || packages.length === 0}>
                      <SelectTrigger id="package_code">
                        <SelectValue placeholder="Choose a service package" />
                      </SelectTrigger>
                      <SelectContent>
                        {packages.map((pkg) => (
                          <SelectItem key={pkg.code} value={pkg.code}>
                            {pkg.name} · {formatCurrencyValue(pkg.price, locationCurrencyCode)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appointment_date">Preferred date</Label>
                    <Input id="appointment_date" type="date" min={getTodayDateValue()} value={form.appointment_date} onChange={(e) => handleAppointmentDateChange(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appointment_time">Preferred time slot</Label>
                    {loadingServiceSlots ? (
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        <CircleDashed className="h-4 w-4 animate-spin" />
                        Loading available slots...
                      </div>
                    ) : (
                      <Select value={form.appointment_time || undefined} onValueChange={handleAppointmentTimeChange} disabled={!form.location_id || !form.appointment_date || !form.package_code || !availableServiceSlots.length}>
                        <SelectTrigger id="appointment_time">
                          <SelectValue placeholder={availableServiceSlots.length ? 'Choose a slot' : 'No slots available'} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableServiceSlots.length ? (
                            availableServiceSlots.map((slot) => (
                              <SelectItem key={slot.time} value={slot.time}>
                                {slot.time} {slot.available_units > 1 ? `(${slot.available_units} units available)` : '(1 unit available)'}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No available slots for this date and package.</div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {locations.find((location) => location.id === form.location_id)?.slot_duration_minutes || 30} minute slots from the selected location settings.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Vehicle details
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_registration_number">Registration number</Label>
                      <Input id="vehicle_registration_number" value={form.vehicle_registration_number} onChange={(e) => handleChange('vehicle_registration_number', e.target.value)} placeholder="MH 12 AB 1234" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicle_brand">Brand</Label>
                      <Input id="vehicle_brand" value={form.vehicle_brand} onChange={(e) => handleChange('vehicle_brand', e.target.value)} placeholder="Honda" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicle_model">Model</Label>
                      <Input id="vehicle_model" value={form.vehicle_model} onChange={(e) => handleChange('vehicle_model', e.target.value)} placeholder="City" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicle_variant">Variant</Label>
                      <Input id="vehicle_variant" value={form.vehicle_variant} onChange={(e) => handleChange('vehicle_variant', e.target.value)} placeholder="VX" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicle_year">Year</Label>
                      <Input id="vehicle_year" value={form.vehicle_year} onChange={(e) => handleChange('vehicle_year', e.target.value)} placeholder="2024" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicle_color">Color</Label>
                      <Input id="vehicle_color" value={form.vehicle_color} onChange={(e) => handleChange('vehicle_color', e.target.value)} placeholder="Silver" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeStep === 2 ? (
            <Card className="shadow-card border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  3. Review and submit
                </CardTitle>
                <CardDescription>Double-check the contact, vehicle and service date before final submission.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer</p>
                    <p className="mt-2 font-semibold text-foreground">{form.customer_name || 'Not provided'}</p>
                    <p className="text-sm text-muted-foreground">{form.customer_phone}</p>
                    <p className="text-sm text-muted-foreground">{form.customer_email || 'No email provided'}</p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service</p>
                    <p className="mt-2 font-semibold text-foreground">{selectedPackage?.name || 'Package not selected'}</p>
                    <p className="text-sm text-muted-foreground">{locations.find((location) => location.id === form.location_id)?.name || 'Location not selected'}</p>
                    <p className="text-sm text-muted-foreground">{form.appointment_date} at {form.appointment_time}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vehicle</p>
                  <p className="mt-2 text-sm text-foreground"><span className="font-semibold">{form.vehicle_brand || 'Brand'}</span> {form.vehicle_model || 'Model'}</p>
                  <p className="text-sm text-muted-foreground">{form.vehicle_registration_number || 'Registration number'} · {form.vehicle_variant || 'Variant'} · {form.vehicle_color || 'Color'}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setActiveStep(1)}>
                    Back
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => {
                    if (!canProceedToStep(1)) {
                      toast({ title: 'Please complete the appointment details first', variant: 'destructive' });
                      setActiveStep(1);
                      return;
                    }
                    handleSubmit(new Event('submit') as any);
                  }} disabled={submitting || loading || !isPhoneVerified}>
                    {submitting ? 'Submitting...' : 'Quick submit'}
                  </Button>
                
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))} disabled={activeStep === 0}>
              Previous
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button type="button" onClick={goToNextStep} disabled={!canProceedToStep(activeStep)}>
                Next
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserRound className="h-5 w-5 text-primary" />
              Summary & history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Phone className="h-4 w-4 text-primary" />
                Contact
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{form.customer_name || 'Customer name'}</p>
              <p className="text-sm text-muted-foreground">{form.customer_phone || 'Phone number'}</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Location
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {locations.find((location) => location.id === form.location_id)?.name || 'Select a location'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wrench className="h-4 w-4 text-primary" />
                Package
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{selectedPackage?.name || 'Choose a service package'}</p>
              <p className="text-sm text-muted-foreground">{selectedPackage ? `${formatCurrencyValue(selectedPackage.price, locationCurrencyCode)} · ${selectedPackage.duration_minutes} minutes` : 'Package details will appear here.'}</p>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Saved vehicle details
              </div>
              {existingVehicles.length ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  {existingVehicles.map((vehicle, index) => (
                    <div key={`${vehicle.registration_number || 'vehicle'}-${index}`} className="rounded-xl border border-primary/10 bg-background/80 p-3 shadow-sm">
                      <p className="font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                      <p className="mt-1">{vehicle.registration_number}</p>
                      <p>{vehicle.variant || 'Variant not available'} · {vehicle.color || 'Color not available'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No saved vehicle found yet. Add your current vehicle details above.</p>
              )}
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                Past bookings
              </div>
              {pastBookings.length ? (
                <div className="space-y-3">
                  {pastBookings.slice(0, 5).map((booking: any, index: number) => {
                    const bookingId = booking.id || booking._id;
                    const bookingDraft = rescheduleDrafts[bookingId] || {
                      date: booking.appointment_date || '',
                      time: booking.appointment_time || '',
                    };

                    return (
                      <div key={`${booking.appointment_number || bookingId || 'booking'}-${index}`} className="rounded-xl border border-amber-500/20 bg-background/80 p-3 text-sm text-muted-foreground shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{booking.status || 'Booked'}</p>
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">History</span>
                        </div>
                        <p className="mt-1">{booking.appointment_date || 'Date unavailable'} · {booking.appointment_time || 'Time unavailable'}</p>
                        <p>{booking.vehicle?.brand || ''} {booking.vehicle?.model || ''}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => usePastBookingDetails(booking)}>
                            Use details
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRescheduleBookingId((prev) => (prev === bookingId ? null : bookingId));
                              setRescheduleDrafts((prev) => ({
                                ...prev,
                                [bookingId]: {
                                  date: booking.appointment_date || '',
                                  time: booking.appointment_time || '',
                                },
                              }));
                            }}
                          >
                            {rescheduleBookingId === bookingId ? 'Close' : String(booking.status || '').toLowerCase() === 'cancelled' ? 'Modify appointment' : 'Modify'}
                          </Button>
                          {String(booking.status || '').toLowerCase() !== 'cancelled' ? (
                            <Button type="button" variant="destructive" size="sm" onClick={() => handleCancelBooking(bookingId, form.customer_phone || booking.customer_phone || '')}>
                              Cancel
                            </Button>
                          ) : null}
                        </div>

                        {rescheduleBookingId === bookingId ? (
                          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="date"
                                value={bookingDraft.date}
                                min={getTodayDateValue()}
                                onChange={(e) =>
                                  setRescheduleDrafts((prev) => ({
                                    ...prev,
                                    [bookingId]: { ...bookingDraft, date: e.target.value },
                                  }))
                                }
                              />
                              <Input
                                type="time"
                                value={bookingDraft.time}
                                min={getMinTimeForDate(bookingDraft.date)}
                                onChange={(e) =>
                                  setRescheduleDrafts((prev) => ({
                                    ...prev,
                                    [bookingId]: { ...bookingDraft, time: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRescheduleBooking(bookingId, form.customer_phone || booking.customer_phone || '')}
                            >
                              Save reschedule
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No previous bookings found for this phone number.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
