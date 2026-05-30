import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { demoAutofillData } from '@/lib/demoAutofillData';
import { apiGet, apiInvokeFunction, apiPost } from '@/lib/apiClient';
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
import { UserPlus, Car, Camera, ImagePlus, CheckCircle2, ArrowRight, ArrowLeft, X, Loader2, CalendarDays, Clock } from 'lucide-react';

type Step = 'customer' | 'license' | 'confirm';

const WalkinPage = () => {
  const { profile, role } = useAuth();
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const [locations, setLocations] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState<Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }>>({});
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [step, setStep] = useState<Step>('customer');

  const todayStr = new Date().toISOString().split('T')[0];
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 30);
  const maxDateStr = maxDateObj.toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', preferredContact: 'phone',
    locationId: profile?.location_id || '', vehicleId: '',
    scheduledDate: todayStr, scheduledTime: '',
  });
  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const canUseDemoData = false;
  // Autofill handler
  const handleDemoAutofill = () => {
    setFormData((prev) => ({
      ...prev,
      ...demoAutofillData.WalkinPage,
      locationId: prev.locationId || demoAutofillData.WalkinPage.locationId,
      scheduledDate: prev.scheduledDate,
    }));
  };
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  useEffect(() => {
    if (dealerLoading) return;

    const params = new URLSearchParams({ is_active: 'true' });
    if (dealerId) params.set('dealer_id', dealerId);
    apiGet<any[]>(`/api/locations?${params}`).then((data) => {
      let locs = data || [];
      if (role === APP_ROLE.DEALER_ADMIN) {
        locs = locs.filter((l: any) => !l.disabled_for_dealer_admin);
      }
      setLocations(locs);
    });
  }, [dealerId, dealerLoading, role]);

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
          const rows = await apiGet<any[]>(
            `/api/vehicles?location_id=${encodeURIComponent(formData.locationId)}&is_available=true&is_active=true`
          );
          setVehicles(rows || []);
        } catch (error) {
          console.error('Failed to load vehicles from API', error);
          setVehicles([]);
        }
      };

      void loadVehicles();
    } else {
      setVehicles([]);
    }
  }, [formData.locationId]);

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

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
  const selectedLocation = locations.find(l => l.id === formData.locationId);
  const selectedLocationStatus = formData.locationId ? locationStatus[formData.locationId] : null;

  const filteredVehicles = useMemo(() => {
      return vehicles.filter((vehicle) => vehicle.is_demo && vehicle.total_units>0 && vehicle.available_units>0);
    }, [vehicles]);

  // Only allow booking if required fields are filled and location is open for today
  const isBookingToday = formData.scheduledDate === todayStr;
  const canProceedFromCustomer = (() => {
    if (!(formData.fullName && formData.phone && formData.vehicleId && formData.locationId)) return false;
    // For today, location must be currently open
    if (isBookingToday && !selectedLocationStatus?.isOpen) return false;
    // For future dates, a time slot must be selected
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
        await updateCustomer(customerId, {
          full_name: formData.fullName,
          email: formData.email || null,
          preferred_contact: formData.preferredContact,
        });
      } else {
        const row = await createCustomer({
          full_name: formData.fullName, phone: formData.phone,
          email: formData.email || null, preferred_contact: formData.preferredContact,
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
          preferred_contact: formData.preferredContact,
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
        const waMessage = `✅ *Walk-in Test Drive Registered*\n\nHi ${formData.fullName},\n\nYour walk-in test drive has been registered:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n🕒 *Time:* ${walkinTime}\n\nYour sales team will guide you shortly.`;

        let waError: unknown = null;
        try {
          await apiInvokeFunction('send-whatsapp', {
            to: formData.phone,
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
          sent_to: formData.phone,
          subject: null,
          body: waMessage,
          status: waError ? 'failed' : 'sent',
          sent_at: waError ? null : new Date().toISOString(),
        });
      }

      // Send email confirmation and log communication.
      if (formData.email) {
        let emailError: unknown = null;
        try {
          await apiInvokeFunction('send-transactional-email', {
            templateName: 'booking-confirmation',
            recipientEmail: formData.email,
            idempotencyKey: `walkin-confirm-${testDrive.id}`,
            templateData: {
              customerName: formData.fullName,
              vehicleName,
              locationName,
              scheduledDate: scheduledDateStr,
              scheduledTime: scheduledTimeStr,            },
          });
        } catch (error) {
          emailError = error;
        }

        const emailBody = `Your walk-in test drive for ${vehicleName} is registered at ${locationName} on ${walkinTime}. Please contact your sales team for help.`;

        await apiPost('/api/communications', {
          customer_id: customerId,
          test_drive_id: testDrive.id,
          type: 'email',
          purpose: 'booking_confirmed',
          sent_to: formData.email,
          subject: 'Walk-in Test Drive Confirmation',
          body: emailBody,
          status: emailError ? 'failed' : 'sent',
          sent_at: emailError ? null : new Date().toISOString(),
        });
      }

      // Send sales person assignment email if email and sales person assigned
      if (formData.email && assignedSalesName) {
        apiInvokeFunction('send-transactional-email', {
          templateName: 'sales-assignment',
          recipientEmail: formData.email,
          idempotencyKey: `sales-assign-${testDrive.id}`,
          templateData: {
            customerName: formData.fullName,
            vehicleName,
            locationName,
            scheduledDate: scheduledDateStr,
            scheduledTime: scheduledTimeStr,
            salesPersonName: assignedSalesName,
            salesPersonPhone: assignedSalesPhone,
          },
        }).catch(err => console.error('Sales assignment email failed:', err));
      }

      toast({ title: walkinToday ? 'Walk-in registered' : 'Booking created', description: `${formData.fullName} has been ${walkinToday ? 'checked in' : 'booked for ' + scheduledDateStr + ' at ' + scheduledTimeStr}${assignedSalesName ? `. Sales executive: ${assignedSalesName}` : ''}.` });
      setFormData({ fullName: '', phone: '', email: '', preferredContact: 'phone', locationId: profile?.location_id || '', vehicleId: '', scheduledDate: todayStr, scheduledTime: '' });
      removeLicense();
      setStep('customer');
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'customer', label: 'Customer', icon: <UserPlus className="h-4 w-4" /> },
    { key: 'license', label: 'License', icon: <Camera className="h-4 w-4" /> },
    { key: 'confirm', label: 'Confirm', icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Walk-in Registration</h1>
        <p className="text-muted-foreground mb-6">Register a walk-in customer for a test drive</p>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full justify-center ${
                i === currentStepIndex
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : i < currentStepIndex
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentStepIndex ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-4 mx-1 shrink-0 ${i < currentStepIndex ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" type="button" onClick={handleDemoAutofill}>
            Demo Autofill
          </Button>
        </div>
        <Card className="shadow-card">
          {/* Step 1: Customer + Vehicle */}
          {step === 'customer' && (
            <>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" /> Customer & Vehicle Information
                </CardTitle>
                <CardDescription>
                  Enter customer details and choose a vehicle. Default profile location is applied automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Enter full name"
                      value={formData.fullName}
                      onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      type="email"
                      placeholder="customer@email.com"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    />
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
                  {formData.locationId ? (
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{selectedLocation?.name || 'Your Location'}</p>
                          <p className="text-xs text-muted-foreground">{selectedLocation?.address || 'Default profile location is applied automatically'}</p>
                        </div>
                        {locationStatus[formData.locationId] && (
                          <Badge variant={locationStatus[formData.locationId]?.isOpen ? 'default' : 'destructive'} className="ml-2 shrink-0">
                            {locationStatus[formData.locationId]?.isOpen ? (
                              <>
                                <span className="inline-block h-2 w-2 rounded-full bg-current mr-1"></span>
                                Open
                              </>
                            ) : (
                              <>
                                <span className="inline-block h-2 w-2 rounded-full bg-current mr-1 animate-pulse"></span>
                                Closed
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      {locationStatus[formData.locationId] && !locationStatus[formData.locationId]?.isOpen && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                          <span className="text-xs text-destructive font-medium">
                            ⏰ This location is closed. Hours: {locationStatus[formData.locationId]?.openTime} - {locationStatus[formData.locationId]?.closeTime}
                          </span>
                        </div>
                      )}
                      {locationStatus[formData.locationId]?.isOpen && (
                        <p className="text-xs text-success flex items-center gap-1">
                          ✓ Open until {locationStatus[formData.locationId]?.closeTime}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select value={formData.locationId} onValueChange={(v) => setFormData((p) => ({ ...p, locationId: v, vehicleId: '' }))}>
                        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => {
                            const status = locationStatus[l.id];
                            const isOpen = status?.isOpen;
                            return (
                              <SelectItem key={l.id} value={l.id} disabled={!isOpen}>
                                <div className="flex items-center gap-2">
                                  <span>{l.name}</span>
                                  {status && (
                                    <>
                                      {isOpen ? (
                                        <Badge variant="outline" className="text-xs h-5 bg-green-50">
                                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600 mr-1"></span>
                                          Open
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs h-5 bg-red-50">
                                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 mr-1"></span>
                                          Closed
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">No default profile location found, select an open location to continue.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Demo Vehicle <span className="text-destructive">*</span></Label>
                  {filteredVehicles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                      {filteredVehicles.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => setFormData((p) => ({ ...p, vehicleId: v.id }))}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            formData.vehicleId === v.id
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">{v.brand} {v.model}</p>
                              <p className="text-sm text-muted-foreground">
                                {v.variant && `${v.variant} · `}{v.color && `${v.color} · `}{v.year}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Demo</Badge>
                                {v.set_price != null && <Badge variant="secondary" className="text-[10px]">Rs {Number(v.set_price).toLocaleString()}</Badge>}
                                {v.vehicle_time_days != null && <Badge variant="secondary" className="text-[10px]">{v.vehicle_time_days} day(s)</Badge>}
                              </div>
                            </div>
                            {formData.vehicleId === v.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {formData.locationId ? 'No demo vehicles available at your location' : 'Select/apply location to load demo vehicles'}
                    </p>
                  )}
                </div>

                {/* Date + Time slot pickers */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" /> Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      min={todayStr}
                      max={maxDateStr}
                      onChange={e => setFormData(p => ({ ...p, scheduledDate: e.target.value, scheduledTime: '' }))}
                    />
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
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Time Slot {!isBookingToday && <span className="text-destructive">*</span>}
                      </Label>
                      {loadingTimeSlots ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading available slots…
                        </div>
                      ) : timeSlots.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {timeSlots.map(slot => {
                            const [h, m] = slot.startTime.split(':').map(Number);
                            const period = h < 12 ? 'AM' : 'PM';
                            const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, scheduledTime: slot.startTime }))}
                                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-all ${
                                  formData.scheduledTime === slot.startTime
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                              >
                                {displayH}:{m.toString().padStart(2, '0')} {period}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-2 text-center border border-dashed border-border rounded-lg">
                          No available slots for this date
                        </p>
                      )}
                      {isBookingToday && !formData.scheduledTime && (
                        <p className="text-[11px] text-muted-foreground">For a walk-in today, current time will be used if no slot is selected.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <div className="flex flex-col items-end gap-2 w-full">
                    {formData.locationId && selectedLocationStatus && isBookingToday && !selectedLocationStatus.isOpen && (
                      <p className="text-xs text-destructive font-medium">
                        ⏰ Cannot proceed for today: This location is closed. Opens at {selectedLocationStatus.openTime}
                      </p>
                    )}
                    {!isBookingToday && !formData.scheduledTime && (
                      <p className="text-xs text-warning font-medium">
                        Please select a time slot for the chosen date.
                      </p>
                    )}
                    <Button onClick={() => setStep('license')} disabled={!canProceedFromCustomer} className="w-full">
                      Next <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Driving License Upload */}
          {step === 'license' && (
            <>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" /> Driving License
                </CardTitle>
                <CardDescription>Capture or upload the customer's driving license</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {showCamera ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2 justify-center">
                      <Button onClick={capturePhoto} size="lg" className="gap-2">
                        <Camera className="h-5 w-5" /> Capture
                      </Button>
                      <Button variant="outline" onClick={stopCamera}>Cancel</Button>
                    </div>
                  </div>
                ) : licensePreview ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={licensePreview} alt="Driving License" className="w-full max-h-72 object-contain bg-muted/30" />
                      <button
                        onClick={removeLicense}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-success flex items-center gap-1.5 justify-center">
                      <CheckCircle2 className="h-4 w-4" /> License captured — {licenseFile?.name}
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-4">
                    <div className="flex justify-center gap-6">
                      <button
                        onClick={startCamera}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
                      >
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <Camera className="h-7 w-7" />
                        </div>
                        <span className="text-sm font-medium">Take Photo</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-foreground"
                      >
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                          <ImagePlus className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium">Upload File</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Accepts JPG, PNG, PDF • Max 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep('customer')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => setStep('confirm')}>
                    {licenseFile ? 'Next' : 'Skip'} <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirm' && (
            <>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" /> Confirm Registration
                </CardTitle>
                <CardDescription>Review the details before registering</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border divide-y divide-border">
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                    <p className="font-medium text-foreground">{formData.fullName}</p>
                    <p className="text-sm text-muted-foreground">{formData.phone}{formData.email && ` • ${formData.email}`}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Vehicle</p>
                    <p className="font-medium text-foreground">
                      {selectedVehicle
                        ? `${selectedVehicle.brand} ${selectedVehicle.model}`
                        : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVehicle
                        && `${selectedVehicle.variant || ''} ${selectedVehicle.color || ''} ${selectedVehicle.year}`.trim()}
                    </p>
                    {selectedVehicle && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Demo Vehicle</Badge>
                        {selectedVehicle.set_price != null && <Badge variant="secondary" className="text-[10px]">Rs {Number(selectedVehicle.set_price).toLocaleString()}</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                    <p className="font-medium text-foreground">{selectedLocation?.name || '—'}</p>
                    <p className="text-sm text-muted-foreground">{selectedLocation?.address}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Date &amp; Time</p>
                    <p className="font-medium text-foreground">
                      {formData.scheduledDate
                        ? new Date(`${formData.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                      {isBookingToday ? ' (Today)' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formData.scheduledTime
                        ? (() => {
                            const [h, m] = formData.scheduledTime.split(':').map(Number);
                            const period = h < 12 ? 'AM' : 'PM';
                            const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
                            return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
                          })()
                        : isBookingToday ? 'Current time (walk-in)' : '—'}
                    </p>
                    <Badge variant={isBookingToday ? 'secondary' : 'outline'} className="text-[10px] mt-1">
                      {isBookingToday ? 'Walk-in' : 'Advance Booking'}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Assigned Sales</p>
                    <p className="font-medium text-foreground">
                      {role === APP_ROLE.SALES ? (profile?.full_name || 'You') : 'Will be assigned by team'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {role === APP_ROLE.SALES ? 'This walk-in will be assigned to you on submit.' : 'No self-assignment for current role.'}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Driving License</p>
                    <div className="flex items-center gap-2">
                      {licenseFile ? (
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-warning/10 text-warning">Not provided</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep('license')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Register Walk-in</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WalkinPage;
