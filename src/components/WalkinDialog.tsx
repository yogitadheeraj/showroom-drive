import { useState, useEffect, useMemo, useRef } from 'react';
import { apiDbQuery, apiGet, apiInvokeFunction, apiPost } from '@/lib/apiClient';
import { createCustomer, findCustomerByPhone, updateCustomer } from '@/lib/customerService';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { isLocationCurrentlyOpen, getAvailableTimeSlots } from '@/lib/slotAvailability';
import { APP_ROLE } from '@/constants/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Car, Camera, ImagePlus, CheckCircle2, ArrowRight, ArrowLeft, X, Loader2, CalendarDays, Clock, Truck, Navigation } from 'lucide-react';
import RouteCalculator, { RouteResult } from '@/components/RouteCalculator';

type Step = 'customer' | 'license' | 'confirm';

interface WalkinDialogProps {
  open: boolean;
  onClose: (submitted?: boolean) => void;
  defaultDate?: string;   // yyyy-MM-dd
  defaultTime?: string;   // HH:mm
  defaultLocationId?: string;
  defaultVehicleId?: string;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
}

const WalkinDialog = ({ open, onClose, defaultDate, defaultTime, defaultLocationId, defaultVehicleId, defaultCustomerName, defaultCustomerPhone }: WalkinDialogProps) => {
  const { profile, role } = useAuth();
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const [locations, setLocations] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState<Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }>>({});
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [sharedVehicles, setSharedVehicles] = useState<any[]>([]);
  const [step, setStep] = useState<Step>('customer');

  const todayStr = new Date().toISOString().split('T')[0];
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 30);
  const maxDateStr = maxDateObj.toISOString().split('T')[0];

  const resolvedDate = defaultDate || todayStr;
  const resolvedLocationId = defaultLocationId || profile?.location_id || '';

  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', preferredContact: 'phone',
    locationId: resolvedLocationId,
    vehicleId: '',
    scheduledDate: resolvedDate,
    scheduledTime: defaultTime || '',
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep('customer');
      setFormData({
        fullName: defaultCustomerName || '', phone: defaultCustomerPhone || '', email: '', preferredContact: 'phone',
        locationId: defaultLocationId || profile?.location_id || '',
        vehicleId: defaultVehicleId || '',
        scheduledDate: defaultDate || todayStr,
        scheduledTime: defaultTime || '',
      });
      setLicenseFile(null);
      setLicensePreview(null);
      setRouteData(null);
    }
  }, [open, defaultDate, defaultTime, defaultLocationId]);

  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [bookedSlotMinutes, setBookedSlotMinutes] = useState<number[]>([]);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (dealerLoading || !open) return;
    // SUPERADMIN sees all active locations; everyone else only their own branch
    if (role === APP_ROLE.SUPERADMIN) {
      const filters: Array<{ field: string; op: 'eq'; value: unknown }> = [{ field: 'is_active', op: 'eq', value: true }];
      if (dealerId) filters.push({ field: 'dealer_id', op: 'eq', value: dealerId });
      apiDbQuery<any[]>({ table: 'locations', action: 'select', select: '*', filters }).then((data) => {
        setLocations(data || []);
      });
    } else if (profile?.location_id) {
      // Fetch only the user's own location (for name/city/hours display)
      apiDbQuery<any[]>({
        table: 'locations', action: 'select', select: '*',
        filters: [{ field: 'id', op: 'eq', value: profile.location_id }],
      }).then((data) => setLocations(data || []));
    }
  }, [dealerId, dealerLoading, role, open, profile?.location_id]);

  useEffect(() => {
    if (locations.length === 0) return;
    const fetchStatus = async () => {
      const status: Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }> = {};
      for (const loc of locations) {
        const r = await isLocationCurrentlyOpen(loc.id);
        status[loc.id] = { isOpen: r.isOpen, openTime: r.openTime, closeTime: r.closeTime };
      }
      setLocationStatus(status);
    };
    fetchStatus();
  }, [locations]);

  useEffect(() => {
    if (!formData.locationId || !formData.scheduledDate) { setVehicles([]); setSharedVehicles([]); return; }
    apiGet<{ local: any[]; shared: any[] }>(
      `/api/vehicles/available?location_id=${encodeURIComponent(formData.locationId)}&date=${formData.scheduledDate}${
        formData.scheduledTime ? `&time=${encodeURIComponent(formData.scheduledTime)}` : ''
      }`
    )
      .then((res) => {
        setVehicles(res?.local || []);
        setSharedVehicles(res?.shared || []);
      })
      .catch(() => { setVehicles([]); setSharedVehicles([]); });
  }, [formData.locationId, formData.scheduledDate, formData.scheduledTime]);

  useEffect(() => {
    if (!formData.locationId || !formData.scheduledDate) { setTimeSlots([]); return; }
    setLoadingTimeSlots(true);
    getAvailableTimeSlots(formData.locationId, formData.scheduledDate, 30).then(({ slots }) => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const isToday = formData.scheduledDate === todayStr;
      const filtered = (slots || []).filter(s => !isToday || (s.startMinutes ?? 0) >= currentMinutes);
      setTimeSlots(filtered.map(s => ({ startTime: s.startTime, endTime: s.endTime })));
    }).catch(() => setTimeSlots([])).finally(() => setLoadingTimeSlots(false));
  }, [formData.locationId, formData.scheduledDate]);

  // Load booked slot minutes for selected vehicle + date
  useEffect(() => {
    if (!formData.vehicleId || !formData.scheduledDate) { setBookedSlotMinutes([]); return; }
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

  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setShowCamera(true);
    } catch {
      toast({ title: 'Camera unavailable', description: 'Please use file upload instead', variant: 'destructive' });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `license-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setLicenseFile(file);
        setLicensePreview(URL.createObjectURL(file));
      }
    }, 'image/jpeg', 0.9);
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLicenseFile(file); setLicensePreview(URL.createObjectURL(file)); }
  };

  const removeLicense = () => {
    setLicenseFile(null);
    if (licensePreview) URL.revokeObjectURL(licensePreview);
    setLicensePreview(null);
  };

  const selectedVehicle = [...vehicles, ...sharedVehicles].find(v => v.id === formData.vehicleId);
  const selectedLocation = locations.find(l => l.id === formData.locationId);
  const selectedLocationStatus = formData.locationId ? locationStatus[formData.locationId] : null;
  const filteredVehicles = useMemo(() => vehicles.filter(v => v.is_demo && v.total_units > 0 && v.available_units > 0), [vehicles]);
  const filteredSharedVehicles = useMemo(() => {
    const localIds = new Set(filteredVehicles.map(v => v.id));
    return sharedVehicles.filter(v => v.is_demo && v.total_units > 0 && v.available_units > 0 && !localIds.has(v.id));
  }, [sharedVehicles, filteredVehicles]);
  const isBookingToday = formData.scheduledDate === todayStr;

  const canProceedFromCustomer = (() => {
    if (!(formData.fullName && formData.phone && formData.vehicleId && formData.locationId)) return false;
    if (isBookingToday && !selectedLocationStatus?.isOpen) return false;
    if (!isBookingToday && !formData.scheduledTime) return false;
    return true;
  })();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const existing = await findCustomerByPhone(formData.phone);
      let customerId: string;
      if (existing) {
        customerId = existing.id;
        await updateCustomer(customerId, { full_name: formData.fullName, email: formData.email || null, preferred_contact: formData.preferredContact });
      } else {
        const row = await createCustomer({ full_name: formData.fullName, phone: formData.phone, email: formData.email || null, preferred_contact: formData.preferredContact });
        if (!row?.id) throw new Error('Failed to create customer');
        customerId = row.id;
      }

      if (licenseFile) {
        const ext = licenseFile.name.split('.').pop();
        const path = `licenses/${customerId}/${Date.now()}.${ext}`;
        try {
          await uploadToStorage('documents', path, licenseFile);
          const publicUrl = await getStoragePublicUrl('documents', path);
          await updateCustomer(customerId, { driving_license_url: publicUrl });
        } catch (err) { console.error('License upload failed:', err); }
      }

      const now = new Date();
      const scheduledDateStr = formData.scheduledDate || now.toISOString().split('T')[0];
      const scheduledTimeStr = formData.scheduledTime || now.toTimeString().slice(0, 5);
      const walkinToday = scheduledDateStr === now.toISOString().split('T')[0];

      const testDrive = await apiPost<any>('/api/test-drives', {
        customer_id: customerId,
        vehicle_id: formData.vehicleId,
        location_id: formData.locationId,
        scheduled_date: scheduledDateStr,
        scheduled_time: scheduledTimeStr,
        source: walkinToday ? 'walkin' : 'staff_booking',
        status: walkinToday ? 'show' : 'scheduled',
        assigned_sales_person_id: role === APP_ROLE.SALES ? profile?.id : null,
        assigned_gro_id: null,
        slot_duration_minutes: 30,
        notes: null,
        metadata: {
          created_via: 'walkin_dialog',
          preferred_contact: formData.preferredContact,
          ...(routeData ? {
            route_destination: routeData.destination,
            route_distance_km: routeData.distanceKm,
            route_duration_minutes: routeData.durationMinutes,
          } : {}),
        },
      } as Record<string, unknown>);

      if (!testDrive?.id) throw new Error('Failed to create test drive');

      const vehicleName = selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.variant || ''}`.trim() : 'your selected vehicle';
      const locationName = selectedLocation?.name || 'our showroom';

      if (formData.phone) {
        const waMessage = `✅ *Walk-in Test Drive Registered*\n\nHi ${formData.fullName},\n\nYour walk-in test drive has been registered:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n🕒 *Time:* ${scheduledDateStr} ${scheduledTimeStr}\n\nYour sales team will guide you shortly.`;
        let waError: unknown = null;
        try {
          await apiInvokeFunction('send-whatsapp', { to: formData.phone, message: waMessage, customerId, testDriveId: testDrive.id, purpose: 'booking_confirmed' });
        } catch (e) { waError = e; }
        await apiPost('/api/communications', { customer_id: customerId, test_drive_id: testDrive.id, type: 'whatsapp', purpose: 'booking_confirmed', sent_to: formData.phone, subject: null, body: waMessage, status: waError ? 'failed' : 'sent', sent_at: waError ? null : new Date().toISOString() } as Record<string, unknown>);
      }

      if (formData.email) {
        let emailError: unknown = null;
        try {
          await apiInvokeFunction('send-transactional-email', { templateName: 'booking-confirmation', recipientEmail: formData.email, idempotencyKey: `walkin-confirm-${testDrive.id}`, templateData: { customerName: formData.fullName, vehicleName, locationName, scheduledDate: scheduledDateStr, scheduledTime: scheduledTimeStr } });
        } catch (e) { emailError = e; }
        await apiPost('/api/communications', { customer_id: customerId, test_drive_id: testDrive.id, type: 'email', purpose: 'booking_confirmed', sent_to: formData.email, subject: 'Walk-in Test Drive Confirmation', body: `Your test drive for ${vehicleName} at ${locationName} on ${scheduledDateStr} ${scheduledTimeStr}.`, status: emailError ? 'failed' : 'sent', sent_at: emailError ? null : new Date().toISOString() } as Record<string, unknown>);
      }

      toast({ title: walkinToday ? 'Walk-in registered' : 'Booking created', description: `${formData.fullName} has been ${walkinToday ? 'checked in' : `booked for ${scheduledDateStr} at ${scheduledTimeStr}`}.` });
      onClose(true);
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { key: 'customer' as Step, label: 'Customer', icon: <UserPlus className="h-3.5 w-3.5" /> },
    { key: 'license' as Step, label: 'License', icon: <Camera className="h-3.5 w-3.5" /> },
    { key: 'confirm' as Step, label: 'Confirm', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stopCamera(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Walk-in Registration
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all w-full justify-center ${
                i === currentStepIndex ? 'bg-primary text-primary-foreground shadow-sm'
                : i < currentStepIndex ? 'bg-success/10 text-success'
                : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentStepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.icon}
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 w-3 mx-0.5 shrink-0 ${i < currentStepIndex ? 'bg-success' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Customer + Vehicle */}
        {step === 'customer' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Enter full name" value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input placeholder="+91 8*********" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="email" placeholder="customer@email.com" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Preferred Contact</Label>
                <Select value={formData.preferredContact} onValueChange={v => setFormData(p => ({ ...p, preferredContact: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label>Location</Label>
              {/* Non-superadmin: always locked to their branch */}
              {role !== APP_ROLE.SUPERADMIN ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{selectedLocation?.name || 'Your Location'}</p>
                      <p className="text-xs text-muted-foreground">{selectedLocation?.address}</p>
                    </div>
                    {locationStatus[formData.locationId] && (
                      <Badge variant={locationStatus[formData.locationId]?.isOpen ? 'default' : 'destructive'} className="ml-2 shrink-0 text-xs">
                        {locationStatus[formData.locationId]?.isOpen ? 'Open' : 'Closed'}
                      </Badge>
                    )}
                  </div>
                  {locationStatus[formData.locationId]?.isOpen && (
                    <p className="text-xs text-success">✓ Open until {locationStatus[formData.locationId]?.closeTime}</p>
                  )}
                </div>
              ) : formData.locationId ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{selectedLocation?.name || 'Your Location'}</p>
                      <p className="text-xs text-muted-foreground">{selectedLocation?.address}</p>
                    </div>
                    {locationStatus[formData.locationId] && (
                      <Badge variant={locationStatus[formData.locationId]?.isOpen ? 'default' : 'destructive'} className="ml-2 shrink-0 text-xs">
                        {locationStatus[formData.locationId]?.isOpen ? 'Open' : 'Closed'}
                      </Badge>
                    )}
                  </div>
                  {locationStatus[formData.locationId]?.isOpen && (
                    <p className="text-xs text-success">✓ Open until {locationStatus[formData.locationId]?.closeTime}</p>
                  )}
                </div>
              ) : (
                <Select value={formData.locationId} onValueChange={v => setFormData(p => ({ ...p, locationId: v, vehicleId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => {
                      const st = locationStatus[l.id];
                      return (
                        <SelectItem key={l.id} value={l.id} disabled={!st?.isOpen}>
                          {l.name} {st && <span className="text-xs ml-1">{st.isOpen ? '(Open)' : '(Closed)'}</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Demo Vehicle <span className="text-destructive">*</span></Label>
              {(filteredVehicles.length > 0 || filteredSharedVehicles.length > 0) ? (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {/* Local vehicles */}
                  {filteredVehicles.length > 0 && (
                    <>
                      {filteredSharedVehicles.length > 0 && (
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">At This Location</p>
                      )}
                      {filteredVehicles.map((v) => (
                        <div key={v.id} onClick={() => setFormData(p => ({ ...p, vehicleId: v.id }))}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${formData.vehicleId === v.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground text-sm">{v.brand} {v.model}</p>
                              <p className="text-xs text-muted-foreground">{v.variant && `${v.variant} · `}{v.color && `${v.color} · `}{v.year}</p>
                            </div>
                            {formData.vehicleId === v.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {/* Shared vehicles from other locations */}
                  {filteredSharedVehicles.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1 flex items-center gap-1">
                        <Truck className="h-3 w-3 text-info" /> Shared Fleet — From Other Locations
                      </p>
                      {filteredSharedVehicles.map((v) => {
                        const isAtLocation = v.vehicle_state === 'at_location' || v.is_local;
                        return (
                          <div key={v.id} onClick={() => setFormData(p => ({ ...p, vehicleId: v.id }))}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${formData.vehicleId === v.id ? 'border-info bg-info/5 ring-1 ring-info' : 'border-info/20 bg-info/3 hover:border-info/50 hover:bg-info/8'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-foreground text-sm">{v.brand} {v.model}</p>
                                  <Badge className="text-[9px] px-1 py-0 bg-info/10 text-info border-info/20">Shared</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{v.variant && `${v.variant} · `}{v.color && `${v.color} · `}{v.year}</p>
                                {!isAtLocation && v.current_location_name && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Truck className="h-3 w-3 text-info shrink-0" />
                                    From: {v.current_location_name}
                                    {v.transit_minutes != null && (
                                      <span className="text-info font-medium"> · ~{v.transit_minutes >= 60
                                        ? `${Math.floor(v.transit_minutes / 60)}h ${v.transit_minutes % 60}m`
                                        : `${v.transit_minutes}m`} transit</span>
                                    )}
                                    {v.distance_km != null && (
                                      <span className="text-muted-foreground/70"> · {v.distance_km} km</span>
                                    )}
                                  </p>
                                )}
                                {isAtLocation && (
                                  <p className="text-[11px] text-success font-medium mt-0.5">Already at this location</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {formData.vehicleId === v.id && <CheckCircle2 className="h-4 w-4 text-info" />}
                                {!isAtLocation && v.transit_minutes != null && (
                                  <Badge className="text-[9px] bg-warning/10 text-warning border-warning/20">
                                    <Navigation className="h-2.5 w-2.5 mr-0.5" />
                                    {v.transit_minutes >= 60
                                      ? `${Math.floor(v.transit_minutes / 60)}h ${v.transit_minutes % 60}m`
                                      : `${v.transit_minutes}m`}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  {formData.locationId && formData.scheduledDate
                    ? 'No vehicles available for selected date/location'
                    : 'Select a location and date to load vehicles'}
                </p>
              )}
            </div>

            {/* Date + Time */}
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={formData.scheduledDate} min={todayStr} max={maxDateStr}
                  onChange={e => setFormData(p => ({ ...p, scheduledDate: e.target.value, scheduledTime: '' }))} />
                {formData.scheduledDate && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${formData.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {isBookingToday ? ' — Today (walk-in)' : ' — Advance booking'}
                  </p>
                )}
              </div>

              {formData.locationId && formData.scheduledDate && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Time Slot {!isBookingToday && <span className="text-destructive">*</span>}
                  </Label>
                  {loadingTimeSlots ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading slots…</div>
                  ) : timeSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
                            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-all text-center leading-tight ${
                              isBooked
                                ? 'border-border/40 bg-muted/40 text-muted-foreground/50 cursor-not-allowed'
                                : isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}>
                            <span className="block">{dh}:{m.toString().padStart(2, '0')} {period}</span>
                            {isBooked && <span className="block text-[9px] font-semibold uppercase tracking-wide text-destructive/60 mt-0.5">Booked</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2 text-center border border-dashed border-border rounded-lg">No available slots for this date</p>
                  )}
                  {isBookingToday && !formData.scheduledTime && (
                    <p className="text-[11px] text-muted-foreground">Current time will be used if no slot is selected.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {formData.locationId && selectedLocationStatus && isBookingToday && !selectedLocationStatus.isOpen && (
                <p className="text-xs text-destructive font-medium">⏰ Location is closed — cannot book for today.</p>
              )}
              {!isBookingToday && !formData.scheduledTime && (
                <p className="text-xs text-warning font-medium">Please select a time slot for the chosen date.</p>
              )}
              <div className="flex gap-2 w-full justify-end">
                <Button variant="outline" onClick={() => onClose()}>Cancel</Button>
                <Button onClick={() => setStep('license')} disabled={!canProceedFromCustomer}>
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Driving License */}
        {step === 'license' && (
          <div className="space-y-4">
            {showCamera ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2 justify-center">
                  <Button onClick={capturePhoto} size="lg" className="gap-2"><Camera className="h-5 w-5" /> Capture</Button>
                  <Button variant="outline" onClick={stopCamera}>Cancel</Button>
                </div>
              </div>
            ) : licensePreview ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={licensePreview} alt="Driving License" className="w-full max-h-56 object-contain bg-muted/30" />
                  <button onClick={removeLicense} className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 transition">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-success flex items-center gap-1.5 justify-center"><CheckCircle2 className="h-4 w-4" /> {licenseFile?.name}</p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-4">
                <div className="flex justify-center gap-6">
                  <button onClick={startCamera} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-primary">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><Camera className="h-6 w-6" /></div>
                    <span className="text-sm font-medium">Take Photo</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center"><ImagePlus className="h-6 w-6 text-muted-foreground" /></div>
                    <span className="text-sm font-medium">Upload File</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Accepts JPG, PNG, PDF • Max 10MB</p>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleFileSelect} />
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('customer')}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => setStep('confirm')}>{licenseFile ? 'Next' : 'Skip'} <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border divide-y divide-border text-sm">
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                <p className="font-medium text-foreground">{formData.fullName}</p>
                <p className="text-muted-foreground">{formData.phone}{formData.email && ` • ${formData.email}`}</p>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Vehicle</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : '—'}</p>
                  {selectedVehicle?.is_shared && <Badge className="text-[9px] bg-info/10 text-info border-info/20 gap-1"><Truck className="h-2.5 w-2.5" /> Shared</Badge>}
                </div>
                <p className="text-muted-foreground">{selectedVehicle && `${selectedVehicle.variant || ''} ${selectedVehicle.color || ''} ${selectedVehicle.year}`.trim()}</p>
                {selectedVehicle?.is_shared && selectedVehicle?.transit_minutes != null && selectedVehicle?.vehicle_state !== 'at_location' && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warning bg-warning/8 border border-warning/20 rounded-md px-2 py-1">
                    <Truck className="h-3 w-3 shrink-0" />
                    <span>Transit required: ~{selectedVehicle.transit_minutes >= 60
                      ? `${Math.floor(selectedVehicle.transit_minutes / 60)}h ${selectedVehicle.transit_minutes % 60}m`
                      : `${selectedVehicle.transit_minutes}m`}
                      {selectedVehicle.distance_km != null && ` · ${selectedVehicle.distance_km} km`}
                      {selectedVehicle.current_location_name && ` from ${selectedVehicle.current_location_name}`}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                <p className="font-medium text-foreground">{selectedLocation?.name || '—'}</p>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Date &amp; Time</p>
                <p className="font-medium text-foreground">
                  {formData.scheduledDate ? new Date(`${formData.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  {isBookingToday ? ' (Today)' : ''}
                </p>
                <p className="text-muted-foreground">
                  {formData.scheduledTime ? (() => {
                    const [h, m] = formData.scheduledTime.split(':').map(Number);
                    const p2 = h < 12 ? 'AM' : 'PM'; const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${dh}:${m.toString().padStart(2, '0')} ${p2}`;
                  })() : isBookingToday ? 'Current time (walk-in)' : '—'}
                </p>
                <Badge variant={isBookingToday ? 'secondary' : 'outline'} className="text-[10px] mt-1">{isBookingToday ? 'Walk-in' : 'Advance Booking'}</Badge>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Driving License</p>
                {licenseFile
                  ? <Badge variant="secondary" className="bg-success/10 text-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Uploaded</Badge>
                  : <Badge variant="secondary" className="bg-warning/10 text-warning">Not provided</Badge>}
              </div>
            </div>

            {/* Route calculator */}
            <div className="rounded-xl border border-border p-3">
              <RouteCalculator
                originLat={selectedLocation?.latitude}
                originLng={selectedLocation?.longitude}
                originName={selectedLocation?.name}
                onRoute={setRouteData}
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('license')}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering…</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Register Walk-in</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WalkinDialog;
