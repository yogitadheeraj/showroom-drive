import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { demoAutofillData } from '@/lib/demoAutofillData';
import { apiGet, apiInvokeFunction, apiPost } from '@/lib/apiClient';
import { logStaffActivity } from '@/lib/activityLogger';
import { createCustomer, findCustomerByPhone, updateCustomer } from '@/lib/customerService';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { isLocationCurrentlyOpen, getAvailableTimeSlots } from '@/lib/slotAvailability';
import { APP_ROLE } from '@/constants/roles';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Car, Camera, ImagePlus, CheckCircle2, ArrowRight, ArrowLeft, X, Loader2, CalendarDays, Clock, AlertCircle, Phone, Mail, MessageSquare, MapPin, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES, validatePhoneForCountry, validateEmail } from '@/lib/countries';

const CONTACT_OPTIONS = [
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

type Step = 'customer' | 'license' | 'confirm';

const WalkinPage = () => {
  const { profile, role } = useAuth();
  const isDealerLevel = [APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN].includes(role as any);
  const { organizationId, dealerId, loading: dealerLoading } = useDealerContext();
  const [locations, setLocations] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState<Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }>>({});
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [sharedVehicles, setSharedVehicles] = useState<any[]>([]);
  const [showAdvancedDate, setShowAdvancedDate] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-CA').split('T')[0];

  const [formData, setFormData] = useState({
    firstName: '', lastName: '',
    countryCode: '+91', phone: '', email: '',
    preferredContact: ['phone'] as string[],
    locationId: profile?.location_id || '', vehicleId: '',
    scheduledDate: todayStr, scheduledTime: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const canUseDemoData = false;
  // Autofill handler
  const handleDemoAutofill = () => {
    setFormData((prev) => ({
      ...prev,
      firstName: 'Demo',
      lastName: 'User',
      countryCode: '+91',
      phone: '9999999999',
      email: demoAutofillData.WalkinPage.email,
      preferredContact: ['phone'],
      locationId: prev.locationId || demoAutofillData.WalkinPage.locationId,
      scheduledDate: prev.scheduledDate,
    }));
  };
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseLightbox, setLicenseLightbox] = useState(false);
  const [bookedSlotMinutes, setBookedSlotMinutes] = useState<number[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  useEffect(() => {
    if (dealerLoading) return;

    if (isDealerLevel) {
      // SUPERADMIN and DEALER_ADMIN see all locations
      const params = new URLSearchParams({ is_active: 'true' });
      const activeOrgId = organizationId || dealerId;
      if (activeOrgId) params.set('orgId', activeOrgId);
      apiGet<any[]>(`/api/v1/locations?${params}`).then((data) => {
        let locs = (data || [])
          .map((l: any) => ({ ...l, id: String(l.id || l._id || '') }))
          .filter((l: any) => Boolean(l.id));
        if (role === APP_ROLE.DEALER_ADMIN) {
          locs = locs.filter((l: any) => !l.disabled_for_dealer_admin);
        }
        setLocations(locs);
      });
    } else if (profile?.location_id) {
      // Branch roles: only fetch their own location
      apiGet<any[]>(`/api/v1/locations?ids=${encodeURIComponent(profile.location_id)}&is_active=true`).then((data) => {
        const locs = (data || [])
          .map((l: any) => ({ ...l, id: String(l.id || l._id || '') }))
          .filter((l: any) => Boolean(l.id));
        setLocations(locs);
      });
    }
  }, [organizationId, dealerId, dealerLoading, role, isDealerLevel, profile?.location_id]);

  useEffect(() => {
    if (locations.length === 0) return;

    const fetchLocationStatus = async () => {
      const status: Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }> = {};
      
      for (const location of locations) {
        const result = await isLocationCurrentlyOpen(location.id);
        status[location.id] = {
          isOpen: result.isOpen,
          openTime: result.openTime,
          closeTime: result.closeTime,
        };
      }
      
      setLocationStatus(status);
    };

    fetchLocationStatus();
  }, [locations]);

  useEffect(() => {
    if (formData.locationId) {
      const loadVehicles = async () => {
        try {
          const params = new URLSearchParams({ location_id: formData.locationId });
          if (formData.scheduledDate) params.set('date', formData.scheduledDate);
          if (formData.scheduledTime) params.set('time', formData.scheduledTime);
          const res = await apiGet<{ local: any[]; shared: any[] }>(`/api/vehicles/available?${params}`);
          setVehicles(res?.local || []);
          setSharedVehicles(res?.shared || []);
        } catch (error) {
          console.error('Failed to load vehicles from API', error);
          setVehicles([]);
          setSharedVehicles([]);
        }
      };
      void loadVehicles();
    } else {
      setVehicles([]);
      setSharedVehicles([]);
    }
  }, [formData.locationId, formData.scheduledDate, formData.scheduledTime]);

  useEffect(() => {
    if (dealerLoading) return;

    if (profile?.location_id && locations.some((l) => l.id === profile.location_id)) {
      const status = locationStatus[profile.location_id];
      // Only set profile location if it's open
      if (status?.isOpen) {
        setFormData((p) => ({ ...p, locationId: profile.location_id }));
        return;
      } else {
        // If profile location is closed, clear it
        setFormData((p) => ({ ...p, locationId: '', vehicleId: '' }));
        return;
      }
    }

    setFormData((p) => {
      if (p.locationId && !locations.some((l) => l.id === p.locationId)) {
        return { ...p, locationId: '', vehicleId: '' };
      }
      return p;
    });
  }, [profile, locations, dealerLoading, locationStatus]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);
  // Load available time slots when date or location changes
  useEffect(() => {
    if (!formData.locationId || !formData.scheduledDate) {
      setTimeSlots([]);
      return;
    }
    setLoadingTimeSlots(true);
    getAvailableTimeSlots(formData.locationId, formData.scheduledDate, 30).then(({ slots }) => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const isToday = formData.scheduledDate === todayStr;
      const filtered = (slots || []).filter(slot =>
        !isToday || (slot.startMinutes ?? 0) >= currentMinutes
      );
      setTimeSlots(filtered.map(s => ({ startTime: s.startTime, endTime: s.endTime })));
    }).catch(() => {
      setTimeSlots([]);
    }).finally(() => {
      setLoadingTimeSlots(false);
    });
  }, [formData.locationId, formData.scheduledDate]);

  // Load booked slot minutes for selected vehicle + date
  useEffect(() => {
    if (!formData.vehicleId || !formData.scheduledDate) {
      setBookedSlotMinutes([]);
      return;
    }
    apiGet<any[]>(
      `/api/test-drives?vehicle_id=${encodeURIComponent(formData.vehicleId)}&scheduled_date=${encodeURIComponent(formData.scheduledDate)}&statuses=scheduled,confirmed,show,in_progress`
    ).then(drives => {
      const mins = (drives || []).map((d: any) => {
        const [h, m] = String(d.scheduled_time || '').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      });
      setBookedSlotMinutes(mins);
    }).catch(() => setBookedSlotMinutes([]));
  }, [formData.vehicleId, formData.scheduledDate]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setShowCamera(true);
    } catch {
      toast({ title: 'Camera unavailable', description: 'Please use file upload instead', variant: 'destructive' });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `license-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setLicenseFile(file);
        setLicensePreview(URL.createObjectURL(file));
      }
    }, 'image/jpeg', 0.9);
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLicenseFile(file);
      setLicensePreview(URL.createObjectURL(file));
    }
  };

  const removeLicense = () => {
    setLicenseFile(null);
    if (licensePreview) URL.revokeObjectURL(licensePreview);
    setLicensePreview(null);
  };

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId) || sharedVehicles.find(v => v.id === formData.vehicleId);
  const selectedLocation = locations.find(l => l.id === formData.locationId);
  const maxDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (selectedLocation?.advance_booking_days ?? 30));
    return d.toLocaleDateString('en-CA').split('T')[0];
  })();
  const selectedLocationStatus = formData.locationId ? locationStatus[formData.locationId] : null;

  // Auto-set phone country code from the selected location's country
  useEffect(() => {
    if (!formData.locationId || locations.length === 0) return;
    const loc = locations.find(l => l.id === formData.locationId);
    if (!loc?.country) return;
    const country = COUNTRIES.find(c => c.name === loc.country);
    if (!country) return;
    if (country.dialCode !== formData.countryCode) {
      setFormData(p => ({ ...p, countryCode: country.dialCode, phone: '' }));
      setFormErrors(p => ({ ...p, phone: '' }));
    }
  }, [formData.locationId, locations]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => v.is_demo && v.total_units > 0 && v.available_units > 0);
  }, [vehicles]);

  const filteredSharedVehicles = useMemo(() => {
    const localIds = new Set(filteredVehicles.map((v) => v.id));
    return sharedVehicles.filter(
      (v) => v.is_demo && v.total_units > 0 && v.available_units > 0 && !localIds.has(v.id)
    );
  }, [sharedVehicles, filteredVehicles]);

  // Only allow booking if required fields are filled and location is open for today
  const isBookingToday = formData.scheduledDate === todayStr;

  const handleSubmit = async () => {
    // Inline validation
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = 'First name is required';
    else if (formData.firstName.trim().length > 40) errs.firstName = 'Max 40 characters';
    if (!formData.lastName.trim()) errs.lastName = 'Last name is required';
    else if (formData.lastName.trim().length > 40) errs.lastName = 'Max 40 characters';
    const phoneErr = !formData.phone.trim() ? 'Phone number is required' : validatePhoneForCountry(formData.phone, formData.countryCode);
    if (phoneErr) errs.phone = phoneErr;
    if (formData.email) { const emailErr = validateEmail(formData.email); if (emailErr) errs.email = emailErr; }
    if (!formData.vehicleId) errs.vehicleId = 'Please select a vehicle';
    if (!formData.locationId) errs.locationId = 'Location is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setIsSubmitting(true);
    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const fullPhone = `${formData.countryCode}${formData.phone}`;
      const existing = await findCustomerByPhone(fullPhone);
      let customerId: string;
      if (existing) {
        customerId = existing.id;
        const updates: Record<string, unknown> = {};
        if (fullName && fullName !== existing.full_name) updates.full_name = fullName;
        if (formData.email !== undefined && formData.email !== (existing.email ?? '')) updates.email = formData.email || null;
        const preferredContact = formData.preferredContact.join(',');
        if (preferredContact && preferredContact !== existing.preferred_contact) updates.preferred_contact = preferredContact;
        if (Object.keys(updates).length > 0) {
          await updateCustomer(customerId, updates);
        }
      } else {
        const row = await createCustomer({
          full_name: fullName, phone: fullPhone,
          email: formData.email || null, preferred_contact: formData.preferredContact.join(','),
        });
        if (!row?.id) throw new Error('Failed to create customer');
        customerId = row.id;
      }

      // Upload license if provided
      if (licenseFile) {
        const ext = licenseFile.name.split('.').pop();
        const path = `licenses/${customerId}/${Date.now()}.${ext}`;
        try {
          await uploadToStorage('documents', path, licenseFile);
          const publicUrl = await getStoragePublicUrl('documents', path);
          await updateCustomer(customerId, { driving_license_url: publicUrl });
        } catch (uploadError) {
          console.error('License upload failed:', uploadError);
        }
      }

      const now = new Date();
      const scheduledDateStr = formData.scheduledDate || now.toISOString().split('T')[0];
      const scheduledTimeStr = formData.scheduledTime || now.toTimeString().slice(0, 5);
      const walkinToday = scheduledDateStr === now.toISOString().split('T')[0];
      const testDrivePayload = {
        customer_id: customerId,
        vehicle_id: formData.vehicleId,
        location_id: formData.locationId,
        scheduled_date: scheduledDateStr,
        scheduled_time: scheduledTimeStr,
        source: walkinToday ? 'walkin' : 'staff_booking',
        status: walkinToday ? 'show' : 'scheduled' as any,
        assigned_sales_person_id: role === APP_ROLE.SALES ? profile?.id : null,
        assigned_gro_id: null,
        slot_duration_minutes: 30,
        notes: null,
        metadata: {
          created_via: 'walkin_page',
          preferred_contact: formData.preferredContact.join(','),
        },
        started_at: null,
        completed_at: null,
        security_checked_in_at: null,
        security_checked_out_at: null,
        key_handed_at: null,
        inspection_submitted_at: null,
        pre_drive_km: null,
        post_drive_km: null,
        pre_drive_fuel_level: null,
        post_drive_fuel_level: null,
        pre_drive_notes: null,
        post_drive_notes: null,
        pre_drive_scratches: null,
        post_drive_scratches: null,
        rescheduled_from: null,
        cancelled_reason: null,
      };

      const testDrive = await apiPost<any>('/api/test-drives', testDrivePayload as Record<string, unknown>);
      if (!testDrive?.id) throw new Error('Failed to create test drive');

      // Fetch assigned sales person details for email
      let assignedSalesName: string | null = null;
      let assignedSalesPhone: string | null = null;
      const assignedId = testDrive.assigned_sales_person_id;
      if (assignedId) {
        const spRows = await apiGet<any[]>(`/api/profiles/${encodeURIComponent(assignedId)}`);
      const sp = Array.isArray(spRows) ? spRows[0] : spRows;
      if (sp) {
          assignedSalesName = sp.full_name;
          assignedSalesPhone = sp.phone;
        }
      }

      const vehicleName = selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.variant || ''}`.trim() : 'your selected vehicle';
      const locationName = selectedLocation?.name || 'our showroom';
      const walkinTime = `${scheduledDateStr} ${scheduledTimeStr}`;

      // Send WhatsApp confirmation and log communication.
      if (formData.phone) {
        const waMessage = `✅ *Walk-in Test Drive Registered*\n\nHi ${fullName},\n\nYour walk-in test drive has been registered:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n🕒 *Time:* ${walkinTime}\n\nYour sales team will guide you shortly.`;

        let waError: unknown = null;
        try {
          await apiInvokeFunction('send-whatsapp', {
            to: fullPhone,
            message: waMessage,
            customerId,
            testDriveId: testDrive.id,
            purpose: 'booking_confirmed',
          });
        } catch (error) {
          waError = error;
        }

        await apiPost('/api/communications', {
          customer_id: customerId,
          test_drive_id: testDrive.id,
          type: 'whatsapp',
          purpose: 'booking_confirmed',
          sent_to: fullPhone,
          subject: null,
          body: waMessage,
          status: waError ? 'failed' : 'sent',
          sent_at: waError ? null : new Date().toISOString(),
        });
      }


      toast({ title: walkinToday ? 'Walk-in registered' : 'Booking created', description: `${fullName} has been ${walkinToday ? 'checked in' : 'booked for ' + scheduledDateStr + ' at ' + scheduledTimeStr}${assignedSalesName ? `. Sales executive: ${assignedSalesName}` : ''}.` });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'walkin_registered',
          label: `${walkinToday ? 'Walk-in registered' : 'Advance booking created'}: ${fullName} — ${vehicleName}`,
          route: '/walkin',
          metadata: { testDriveId: testDrive.id, customerId, customerName: fullName, vehicleName, locationName, scheduledDate: formData.scheduledDate, scheduledTime: formData.scheduledTime, assignedSalesName: assignedSalesName ?? null },
        });
      }
      setFormData(prev => ({ firstName: '', lastName: '', countryCode: prev.countryCode, phone: '', email: '', preferredContact: ['phone'], locationId: isDealerLevel ? prev.locationId : (profile?.location_id || ''), vehicleId: '', scheduledDate: todayStr, scheduledTime: '' }));
      setFormErrors({});
      removeLicense();
      setShowAdvancedDate(false);
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-3">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Walk-in Registration</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {selectedLocation ? (
                <>
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {selectedLocation.name}
                  {selectedLocationStatus && (
                    <Badge variant={selectedLocationStatus.isOpen ? 'default' : 'destructive'} className="text-[10px] h-4 px-1.5 ml-1">
                      {selectedLocationStatus.isOpen ? '● Open' : '● Closed'}
                    </Badge>
                  )}
                </>
              ) : 'Register a customer for a test drive'}
            </p>
          </div>
        </div>

        {/* Dealer-level: compact location selector */}
        {isDealerLevel && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <Select
              value={formData.locationId}
              onValueChange={v => setFormData(p => ({ ...p, locationId: v, vehicleId: '', scheduledTime: '' }))}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 focus:ring-0 flex-1 font-medium">
                <SelectValue placeholder="Choose a location to begin..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(l => {
                  const s = locationStatus[l.id];
                  const lc = COUNTRIES.find(c => c.name === l.country);
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="flex items-center gap-2">
                        {lc && <span>{lc.flag}</span>}
                        <span className="font-medium">{l.name}</span>
                        {l.city && <span className="text-xs text-muted-foreground">{l.city}</span>}
                        {s && <span className={`text-[10px] font-bold ${s.isOpen ? 'text-success' : 'text-destructive'}`}>● {s.isOpen ? 'Open' : 'Closed'}</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {formData.locationId && selectedLocation?.country && (() => {
              const c = COUNTRIES.find(cnt => cnt.name === selectedLocation.country);
              return c ? <span className="text-lg shrink-0">{c.flag}</span> : null;
            })()}
          </div>
        )}

        {(!isDealerLevel || formData.locationId) ? (
          <Card className="shadow-card">
            <CardContent className="p-4 space-y-3.5">

              {/* Phone — first and prominent */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Phone <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-input bg-muted/50 text-sm shrink-0 select-none">
                    <span>{COUNTRIES.find(c => c.dialCode === formData.countryCode)?.flag ?? '🌍'}</span>
                    <span className="font-mono text-xs">{formData.countryCode}</span>
                  </div>
                  <Input
                    type="tel"
                    placeholder={COUNTRIES.find(c => c.dialCode === formData.countryCode)?.phoneHint || 'Phone number'}
                    value={formData.phone}
                    autoFocus
                    className={cn('flex-1', formErrors.phone && 'border-destructive')}
                    onChange={e => { setFormData(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') })); if (formErrors.phone) setFormErrors(p => ({ ...p, phone: '' })); }}
                  />
                </div>
                {formErrors.phone && <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3 shrink-0" />{formErrors.phone}</p>}
              </div>

              {/* Name — 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">First Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="First" value={formData.firstName} maxLength={40}
                    className={cn(formErrors.firstName && 'border-destructive')}
                    onChange={e => { setFormData(p => ({ ...p, firstName: e.target.value })); if (formErrors.firstName) setFormErrors(p => ({ ...p, firstName: '' })); }} />
                  {formErrors.firstName && <p className="text-xs text-destructive mt-0.5">{formErrors.firstName}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Last Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Last" value={formData.lastName} maxLength={40}
                    className={cn(formErrors.lastName && 'border-destructive')}
                    onChange={e => { setFormData(p => ({ ...p, lastName: e.target.value })); if (formErrors.lastName) setFormErrors(p => ({ ...p, lastName: '' })); }} />
                  {formErrors.lastName && <p className="text-xs text-destructive mt-0.5">{formErrors.lastName}</p>}
                </div>
              </div>

              {/* Email — optional */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Email <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                <Input type="email" placeholder="customer@email.com" value={formData.email}
                  className={cn(formErrors.email && 'border-destructive')}
                  onChange={e => { setFormData(p => ({ ...p, email: e.target.value })); if (formErrors.email) setFormErrors(p => ({ ...p, email: '' })); }} />
                {formErrors.email && <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3 shrink-0" />{formErrors.email}</p>}
              </div>

              {/* Demo Vehicle — compact 2-col grid */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Demo Vehicle <span className="text-destructive">*</span></Label>
                {!formData.locationId ? (
                  <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">Select a location first</p>
                ) : filteredVehicles.length === 0 && filteredSharedVehicles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">No demo vehicles available at this location</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {[...filteredVehicles, ...filteredSharedVehicles].map(v => (
                      <button key={v.id} type="button"
                        onClick={() => setFormData(p => ({ ...p, vehicleId: v.id }))}
                        className={cn(
                          'p-2.5 rounded-lg border text-left transition-all relative',
                          formData.vehicleId === v.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                        )}>
                        {formData.vehicleId === v.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary absolute top-2 right-2" />}
                        <p className="font-medium text-sm leading-tight pr-5">{v.brand} {v.model}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{[v.color, String(v.year)].filter(Boolean).join(' · ')}</p>
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          {v.variant && <span className="text-[10px] text-muted-foreground">{v.variant}</span>}
                          {v.set_price != null && <span className="text-[10px] font-semibold text-primary">₹{(Number(v.set_price) / 100000).toFixed(1)}L</span>}
                          {v.is_shared && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide bg-info/10 text-info px-1 py-0.5 rounded flex items-center gap-0.5">
                              <Truck className="h-2.5 w-2.5" /> Shared
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {formErrors.vehicleId && <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3 shrink-0" />{formErrors.vehicleId}</p>}
              </div>

              {/* Date — defaults to today, toggle for advance booking */}
              <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {isBookingToday
                        ? 'Today — Walk-in'
                        : new Date(`${formData.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    {formData.scheduledTime && (() => {
                      const [h, m] = formData.scheduledTime.split(':').map(Number);
                      const period = h < 12 ? 'AM' : 'PM';
                      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      return <p className="text-[11px] text-muted-foreground">{dh}:{String(m).padStart(2, '0')} {period}</p>;
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdvancedDate(v => !v);
                    if (showAdvancedDate) setFormData(p => ({ ...p, scheduledDate: todayStr, scheduledTime: '' }));
                  }}
                  className="text-xs text-primary hover:underline underline-offset-2"
                >
                  {showAdvancedDate ? '← Back to today' : 'Advance booking?'}
                </button>
              </div>

              {showAdvancedDate && (
                <div className="space-y-3 bg-muted/30 rounded-xl p-3 border border-border/50">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Date</Label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      min={todayStr}
                      max={maxDateStr}
                      onChange={e => setFormData(p => ({ ...p, scheduledDate: e.target.value, scheduledTime: '' }))}
                    />
                  </div>
                  {formData.locationId && !isBookingToday && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Time Slot <span className="text-destructive">*</span></Label>
                      {loadingTimeSlots ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading slots...
                        </div>
                      ) : timeSlots.length > 0 ? (
                        <div className="grid grid-cols-4 gap-1.5">
                          {timeSlots.map(slot => {
                            const [h, m] = slot.startTime.split(':').map(Number);
                            const period = h < 12 ? 'AM' : 'PM';
                            const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
                            const slotMin = h * 60 + m;
                            const isBooked = bookedSlotMinutes.some(bm => Math.abs(bm - slotMin) < 30);
                            const isSelected = formData.scheduledTime === slot.startTime;
                            return (
                              <button key={slot.startTime} type="button"
                                disabled={isBooked}
                                onClick={() => !isBooked && setFormData(p => ({ ...p, scheduledTime: slot.startTime }))}
                                className={cn(
                                  'rounded-md border px-1.5 py-1.5 text-[11px] font-medium transition-all text-center leading-tight',
                                  isBooked
                                    ? 'border-border/40 bg-muted/40 text-muted-foreground/50 cursor-not-allowed'
                                    : isSelected
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                )}>
                                <span className="block">{dh}:{String(m).padStart(2, '0')} {period}</span>
                                {isBooked && <span className="block text-[9px] font-semibold uppercase tracking-wide text-destructive/60 mt-0.5">Booked</span>}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No available slots for this date</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Location closed warning */}
              {isBookingToday && selectedLocationStatus?.isOpen === false && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">Location is closed — opens at {selectedLocationStatus.openTime}</p>
                </div>
              )}

              {/* License upload — compact optional inline */}
              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Driving License <span className="font-normal">(optional)</span>
                  </Label>
                  {!licensePreview && !showCamera && (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={startCamera}
                        className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2">
                        <Camera className="h-3.5 w-3.5" /> Camera
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2">
                        <ImagePlus className="h-3.5 w-3.5" /> Upload
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleFileSelect} />
                    </div>
                  )}
                </div>
                {showCamera && (
                  <div className="space-y-2">
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={capturePhoto} className="gap-1.5">
                        <Camera className="h-3.5 w-3.5" /> Capture
                      </Button>
                      <Button size="sm" variant="outline" onClick={stopCamera}>Cancel</Button>
                    </div>
                  </div>
                )}
{licensePreview && (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setLicenseLightbox(true)}
                        className="block rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition"
                      >
                        <img src={licensePreview} alt="License" className="h-16 w-24 object-cover" />
                      </button>
                      <button
                        onClick={removeLicense}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {licenseFile?.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Tap thumbnail to preview</p>
                    </div>
                  </div>
                )}

                {/* License lightbox */}
                {licenseLightbox && licensePreview && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setLicenseLightbox(false)}
                  >
                    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                      <img src={licensePreview} alt="Driving License" className="w-full rounded-xl shadow-2xl" />
                      <button
                        onClick={() => setLicenseLightbox(false)}
                        className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-gray-100 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Advance booking time slot warning */}
              {!isBookingToday && !formData.scheduledTime && showAdvancedDate && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Select a time slot for the advance booking date
                </p>
              )}

              {/* Register button */}
              <Button
                className="w-full mt-1"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || (isBookingToday && selectedLocationStatus?.isOpen === false) || (!isBookingToday && !formData.scheduledTime)}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Register Walk-in</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardContent className="p-10 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground font-medium">Select a location above to begin</p>
              <p className="text-xs text-muted-foreground mt-1">Choose the branch where the customer has walked in.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WalkinPage;
