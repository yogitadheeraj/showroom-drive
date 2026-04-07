import { useState, useEffect, useMemo, useRef } from 'react';
import { demoAutofillData } from '@/lib/demoAutofillData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { isLocationCurrentlyOpen } from '@/lib/slotAvailability';
import { APP_ROLE } from '@/constants/roles';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Car, Camera, ImagePlus, CheckCircle2, ArrowRight, ArrowLeft, X, Loader2 } from 'lucide-react';

type Step = 'customer' | 'license' | 'confirm';

const WalkinPage = () => {
  const { profile, role } = useAuth();
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const [locations, setLocations] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState<Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }>>({});
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState<'new' | 'used'>('new');
  // Wheel segment is auto-adjusted from selected vehicle; no manual filter for walk-in
  const [step, setStep] = useState<Step>('customer');
  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', preferredContact: 'phone',
    locationId: profile?.location_id || '', vehicleId: '', selectedVariantVehicleId: '',
  });
  const [canUseDemoData, setCanUseDemoData] = useState(false);
  // Autofill handler
  const handleDemoAutofill = () => {
    setFormData((prev) => ({
      ...prev,
      ...demoAutofillData.WalkinPage,
      locationId: prev.locationId || demoAutofillData.WalkinPage.locationId,
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

    let query = supabase.from('locations').select('*').eq('is_active', true);
    if (dealerId) query = query.eq('dealer_id', dealerId);

    query.then(({ data }) => {
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
      supabase.from('vehicles').select('*')
        .eq('location_id', formData.locationId)
        .eq('is_available', true).eq('is_active', true)
        .then(({ data }) => setVehicles(data || []));
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
        setFormData((p) => ({ ...p, locationId: '', vehicleId: '', selectedVariantVehicleId: '' }));
        return;
      }
    }

    setFormData((p) => {
      if (p.locationId && !locations.some((l) => l.id === p.locationId)) {
        return { ...p, locationId: '', vehicleId: '', selectedVariantVehicleId: '' };
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
  const selectedVariantVehicle = vehicles.find(v => v.id === formData.selectedVariantVehicleId);
  const selectedLocation = locations.find(l => l.id === formData.locationId);
  const selectedLocationStatus = formData.locationId ? locationStatus[formData.locationId] : null;
  const getDemoVehicleForVariant = (variantVehicleId: string) => {
    if (!variantVehicleId) return null;
    return vehicles.find((vehicle) => vehicle.is_demo && vehicle.demo_for_vehicle_id === variantVehicleId && vehicle.is_available) || null;
  };
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      if (vehicle.is_demo) return false;
      if (vehicleCategoryFilter === 'used' && !vehicle.is_used) return false;
      if (vehicleCategoryFilter === 'new' && !(vehicle.is_new && !vehicle.is_used)) return false;
      return true;
    });
  }, [vehicles, vehicleCategoryFilter]);

  // Only allow booking if current time is at least 30 mins before closing
  const canProceedFromCustomer = (() => {
    if (!(formData.fullName && formData.phone && formData.vehicleId && formData.locationId && selectedLocationStatus?.isOpen)) return false;
    if (!selectedLocationStatus?.closeTime) return true;
    try {
      const now = new Date();
      const [closeHour, closeMin] = selectedLocationStatus.closeTime.split(':').map(Number);
      const closeDate = new Date(now);
      closeDate.setHours(closeHour, closeMin, 0, 0);
      // 30 minutes before closing
      const lastAllowed = new Date(closeDate.getTime() - 30 * 60000);
      return now <= lastAllowed;
    } catch {
      return true;
    }
  })();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: existing } = await supabase.from('customers').select('id').eq('phone', formData.phone).maybeSingle();
      let customerId: string;
      if (existing) {
        customerId = existing.id;
      } else {
        const { data, error } = await supabase.from('customers').insert({
          full_name: formData.fullName, phone: formData.phone,
          email: formData.email || null, preferred_contact: formData.preferredContact,
        }).select('id').single();
        if (error) throw error;
        customerId = data.id;
      }

      // Upload license if provided
      if (licenseFile) {
        const ext = licenseFile.name.split('.').pop();
        const path = `licenses/${customerId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, licenseFile);
        if (uploadError) {
          console.error('License upload failed:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
          await supabase.from('customers').update({ driving_license_url: publicUrl }).eq('id', customerId);
        }
      }

      const now = new Date();
      const { data: testDrive, error } = await supabase.from('test_drives').insert({
        customer_id: customerId, vehicle_id: formData.vehicleId,
        location_id: formData.locationId,
        scheduled_date: now.toISOString().split('T')[0],
        scheduled_time: now.toTimeString().slice(0, 5),
        source: 'walkin', status: 'show' as any,
        assigned_sales_person_id: role === APP_ROLE.SALES ? profile?.id : null,
      }).select('id, assigned_sales_person_id').single();
      if (error) throw error;

      // Fetch assigned sales person details for email
      let assignedSalesName: string | null = null;
      let assignedSalesPhone: string | null = null;
      const assignedId = testDrive.assigned_sales_person_id;
      if (assignedId) {
        const { data: sp } = await supabase.from('profiles')
          .select('full_name, phone')
          .eq('id', assignedId)
          .single();
        if (sp) {
          assignedSalesName = sp.full_name;
          assignedSalesPhone = sp.phone;
        }
      }

      const displayVehicle = vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle;
      const vehicleName = displayVehicle ? `${displayVehicle.brand} ${displayVehicle.model} ${displayVehicle.variant || ''}`.trim() : 'your selected vehicle';
      const locationName = selectedLocation?.name || 'our showroom';
      const walkinTime = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;

      // Send WhatsApp confirmation and log communication.
      if (formData.phone) {
        const waMessage = `✅ *Walk-in Test Drive Registered*\n\nHi ${formData.fullName},\n\nYour walk-in test drive has been registered:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n🕒 *Time:* ${walkinTime}\n\nYour sales team will guide you shortly.`;

        const { error: waError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: formData.phone,
            message: waMessage,
            customerId,
            testDriveId: testDrive.id,
            purpose: 'booking_confirmed',
          },
        });

        await supabase.from('communications').insert({
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
        const { error: emailError } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-confirmation',
            recipientEmail: formData.email,
            idempotencyKey: `walkin-confirm-${testDrive.id}`,
            templateData: {
              customerName: formData.fullName,
              vehicleName,
              locationName,
              scheduledDate: now.toISOString().split('T')[0],
              scheduledTime: now.toTimeString().slice(0, 5),
            },
          },
        });

        const emailBody = `Your walk-in test drive for ${vehicleName} is registered at ${locationName} on ${walkinTime}. Please contact your sales team for help.`;

        await supabase.from('communications').insert({
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
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'sales-assignment',
            recipientEmail: formData.email,
            idempotencyKey: `sales-assign-${testDrive.id}`,
            templateData: {
              customerName: formData.fullName,
              vehicleName,
              locationName,
              scheduledDate: now.toISOString().split('T')[0],
              scheduledTime: now.toTimeString().slice(0, 5),
              salesPersonName: assignedSalesName,
              salesPersonPhone: assignedSalesPhone,
            },
          },
        }).catch(err => console.error('Sales assignment email failed:', err));
      }

      toast({ title: 'Walk-in registered', description: `${formData.fullName} has been checked in${assignedSalesName ? `. Sales executive: ${assignedSalesName}` : ''}.` });
      setFormData({ fullName: '', phone: '', email: '', preferredContact: 'phone', locationId: profile?.location_id || '', vehicleId: '', selectedVariantVehicleId: '' });
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
                      <Select value={formData.locationId} onValueChange={(v) => setFormData((p) => ({ ...p, locationId: v, vehicleId: '', selectedVariantVehicleId: '' }))}>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Vehicle Category</Label>
                    <Select
                      value={vehicleCategoryFilter}
                      onValueChange={(v: 'new' | 'used') => {
                        setVehicleCategoryFilter(v);
                        setFormData((p) => ({ ...p, vehicleId: '', selectedVariantVehicleId: '' }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New Cars</SelectItem>
                        <SelectItem value="used">Used Cars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Vehicle <span className="text-destructive">*</span></Label>
                  {filteredVehicles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                      {filteredVehicles.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => {
                            if (vehicleCategoryFilter === 'used') {
                              setFormData((p) => ({ ...p, selectedVariantVehicleId: v.id, vehicleId: v.id }));
                              return;
                            }

                            const demoVehicle = getDemoVehicleForVariant(v.id);
                            setFormData((p) => ({ ...p, selectedVariantVehicleId: v.id, vehicleId: demoVehicle?.id || '' }));
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            formData.selectedVariantVehicleId === v.id
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
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{v.is_used ? 'Used' : 'New'}</Badge>
                                {v.set_price != null && <Badge variant="secondary" className="text-[10px]">Rs {Number(v.set_price).toLocaleString()}</Badge>}
                                {v.vehicle_time_days != null && <Badge variant="secondary" className="text-[10px]">{v.vehicle_time_days} day(s)</Badge>}
                                {vehicleCategoryFilter === 'new' && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {getDemoVehicleForVariant(v.id) ? 'Demo linked' : 'No demo'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {formData.selectedVariantVehicleId === v.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {formData.locationId ? 'No vehicles available in this category at your location' : 'Select/apply location to load vehicles'}
                    </p>
                  )}
                  {vehicleCategoryFilter === 'new' && formData.selectedVariantVehicleId && !formData.vehicleId && (
                    <p className="text-xs text-destructive">No demo vehicle is linked to the selected New variant.</p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <div className="flex flex-col items-end gap-2 w-full">
                    {formData.locationId && selectedLocationStatus && !selectedLocationStatus.isOpen && (
                      <p className="text-xs text-destructive font-medium">
                        ⏰ Cannot proceed: This location is closed. Opens at {selectedLocationStatus.openTime}
                      </p>
                    )}
                    <Button onClick={() => setStep('license')} disabled={!canProceedFromCustomer} className="w-full">
                      Next <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                    {!canProceedFromCustomer && selectedLocationStatus?.closeTime && (
                      <p className="text-xs text-destructive font-medium mt-1">
                        Walk-in booking is only allowed at least 30 minutes before closing time ({selectedLocationStatus.closeTime}).
                      </p>
                    )}
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
                      {(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)
                        ? `${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.brand} ${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.model}`
                        : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)
                        && `${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.variant || ''} ${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.color || ''} ${(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.year}`.trim()}
                    </p>
                    {(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{vehicleCategoryFilter === 'used' ? 'Used' : 'New'}</Badge>
                        {(vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.set_price != null && <Badge variant="secondary" className="text-[10px]">Rs {Number((vehicleCategoryFilter === 'new' ? selectedVariantVehicle : selectedVehicle)?.set_price).toLocaleString()}</Badge>}
                        {vehicleCategoryFilter === 'new' && selectedVehicle?.is_demo && <Badge variant="secondary" className="text-[10px]">Demo assigned</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                    <p className="font-medium text-foreground">{selectedLocation?.name || '—'}</p>
                    <p className="text-sm text-muted-foreground">{selectedLocation?.address}</p>
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
