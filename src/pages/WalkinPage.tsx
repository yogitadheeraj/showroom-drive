import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

type Step = 'customer' | 'vehicle' | 'license' | 'confirm';

const WalkinPage = () => {
  const { profile, role } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [step, setStep] = useState<Step>('customer');
  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', preferredContact: 'phone',
    locationId: profile?.location_id || '', vehicleId: '',
  });
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
    supabase.from('locations').select('*').eq('is_active', true).then(({ data }) => setLocations(data || []));
  }, []);

  useEffect(() => {
    if (formData.locationId) {
      supabase.from('vehicles').select('*')
        .eq('location_id', formData.locationId)
        .eq('is_available', true).eq('is_active', true)
        .then(({ data }) => setVehicles(data || []));
    }
  }, [formData.locationId]);

  useEffect(() => {
    if (profile?.location_id) setFormData(p => ({ ...p, locationId: profile.location_id }));
  }, [profile]);

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
  const selectedLocation = locations.find(l => l.id === formData.locationId);

  const canProceedFromCustomer = formData.fullName && formData.phone;
  const canProceedFromVehicle = formData.vehicleId && formData.locationId;

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
      }).select('id').single();
      if (error) throw error;

      const vehicleName = selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'your selected vehicle';
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

      toast({ title: 'Walk-in registered', description: `${formData.fullName} has been checked in and communications sent` });
      setFormData({ fullName: '', phone: '', email: '', preferredContact: 'phone', locationId: profile?.location_id || '', vehicleId: '' });
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
    { key: 'vehicle', label: 'Vehicle', icon: <Car className="h-4 w-4" /> },
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

        <Card className="shadow-card">
          {/* Step 1: Customer Info */}
          {step === 'customer' && (
            <>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" /> Customer Information
                </CardTitle>
                <CardDescription>Enter the walk-in customer's details</CardDescription>
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
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setStep('vehicle')} disabled={!canProceedFromCustomer}>
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Vehicle Selection */}
          {step === 'vehicle' && (
            <>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" /> Select Vehicle
                </CardTitle>
                <CardDescription>Location is fixed to your profile. Choose a vehicle for the test drive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{selectedLocation?.name || 'Your Location'}</p>
                    <p className="text-xs text-muted-foreground">{selectedLocation?.address || 'Default profile location is applied automatically'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle <span className="text-destructive">*</span></Label>
                  {vehicles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                      {vehicles.map(v => (
                        <div
                          key={v.id}
                          onClick={() => setFormData(p => ({ ...p, vehicleId: v.id }))}
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
                      {formData.locationId ? 'No vehicles available at your location' : 'No default location found on your profile'}
                    </p>
                  )}
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep('customer')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => setStep('license')} disabled={!canProceedFromVehicle}>
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
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
                  <Button variant="outline" onClick={() => setStep('vehicle')}>
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
                      {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVehicle && `${selectedVehicle.variant || ''} ${selectedVehicle.color || ''} ${selectedVehicle.year}`.trim()}
                    </p>
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
