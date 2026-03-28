import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import VehicleSpecCard from '@/components/booking/VehicleSpecCard';
import { Car, CheckCircle, Zap, ArrowLeft, ArrowRight, MapPin, Clock, User, ChevronRight, Shield, GitCompareArrows, Map as MapIcon, ExternalLink } from 'lucide-react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

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

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [operatingHours, setOperatingHours] = useState<any[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', preferredContact: 'phone',
    locationId: '', vehicleId: '', scheduledDate: '', scheduledTime: '',
    selectedModel: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
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
      supabase.from('location_operating_hours').select('*'),
      supabase.from('location_blocked_slots').select('*'),
    ]).then(([vRes, lRes, ohRes, bsRes]) => {
      setAllVehicles(vRes.data || []);
      setLocations(lRes.data || []);
      setOperatingHours(ohRes.data || []);
      setBlockedSlots(bsRes.data || []);
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

  // Get operating hours for selected location on selected date
  const selectedDateHours = useMemo(() => {
    if (!formData.locationId || !formData.scheduledDate) return null;
    const date = new Date(formData.scheduledDate);
    const dayOfWeek = date.getDay();
    return operatingHours.find(oh => oh.location_id === formData.locationId && oh.day_of_week === dayOfWeek);
  }, [formData.locationId, formData.scheduledDate, operatingHours]);

  // Generate time slots based on operating hours
  const timeSlots = useMemo(() => {
    if (!selectedDateHours || selectedDateHours.is_closed) return [];
    const slots: string[] = [];
    const [openH, openM] = selectedDateHours.open_time.split(':').map(Number);
    const [closeH, closeM] = selectedDateHours.close_time.split(':').map(Number);
    
    let h = openH, m = openM;
    while (h < closeH || (h === closeH && m < closeM)) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      // Check if this slot is blocked
      const isBlocked = blockedSlots.some(bs =>
        bs.location_id === formData.locationId &&
        bs.blocked_date === formData.scheduledDate &&
        timeStr >= bs.start_time.substring(0, 5) &&
        timeStr < bs.end_time.substring(0, 5)
      );
      if (!isBlocked) slots.push(timeStr);
      m += 30;
      if (m >= 60) { h++; m = 0; }
    }
    return slots;
  }, [selectedDateHours, blockedSlots, formData.locationId, formData.scheduledDate]);

  // Min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // Max date = 30 days out
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const canProceed = () => {
    switch (step) {
      case 0: return !!formData.selectedModel;
      case 1: return !!formData.scheduledDate;
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
        source: 'online',
      }).select('id').single();
      if (tdError) throw tdError;

      const vehicleName = selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'your selected vehicle';
      const selectedLocation = locations.find(l => l.id === formData.locationId);
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
                  <Input id="date" type="date" min={minDate} max={maxDateStr}
                    value={formData.scheduledDate}
                    onChange={e => setFormData(p => ({ ...p, scheduledDate: e.target.value, scheduledTime: '', locationId: '', vehicleId: '' }))}
                    className="text-base"
                  />
                </div>
                {formData.scheduledDate && (
                  <p className="text-sm text-muted-foreground">
                    📅 Selected: <span className="font-medium text-foreground">
                      {new Date(formData.scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Location & Variant Selection */}
            {step === 2 && (
              <div className="space-y-4">
                {availableLocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No locations have this model available. Try a different model.</p>
                ) : (
                  <>
                    <div className="grid gap-3">
                      {availableLocations.map(loc => {
                        const isSelected = formData.locationId === loc.id;
                        const locVehicles = modelVehicles.filter(v => v.location_id === loc.id);
                        const dayOfWeek = new Date(formData.scheduledDate).getDay();
                        const hours = operatingHours.find(oh => oh.location_id === loc.id && oh.day_of_week === dayOfWeek);
                        const isClosed = hours?.is_closed;
                        const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(loc.address + ' ' + loc.city)}`;

                        if (isClosed) return (
                          <div key={loc.id} className="p-4 rounded-xl border border-border bg-muted/30 opacity-60">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{loc.name}</p>
                                <p className="text-xs text-muted-foreground">{loc.address}, {loc.city}</p>
                              </div>
                              <Badge variant="secondary">Closed</Badge>
                            </div>
                          </div>
                        );

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
                              </div>
                              <div className="flex items-center gap-2">
                                {hours && (
                                  <span className="text-xs text-muted-foreground">
                                    {hours.open_time?.substring(0, 5)} – {hours.close_time?.substring(0, 5)}
                                  </span>
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
                {selectedDateHours?.is_closed ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">This location is closed on the selected day.</p>
                    <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>Change Date</Button>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No available time slots for this date.</p>
                    <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>Change Date</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map(slot => {
                      const isSelected = formData.scheduledTime === slot;
                      const [h] = slot.split(':').map(Number);
                      const period = h < 12 ? 'AM' : 'PM';
                      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      const displayTime = `${displayH}:${slot.split(':')[1]} ${period}`;
                      return (
                        <button key={slot} type="button"
                          onClick={() => setFormData(p => ({ ...p, scheduledTime: slot }))}
                          className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                            isSelected ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                          }`}
                        >
                          {displayTime}
                        </button>
                      );
                    })}
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
                    <div><span className="text-muted-foreground">Location:</span> <span className="font-medium text-foreground">{locations.find(l => l.id === formData.locationId)?.name || '—'}</span></div>
                    <div><span className="text-muted-foreground">Time:</span> <span className="font-medium text-foreground">{formData.scheduledTime || '—'}</span></div>
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
