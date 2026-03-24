import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Car, CheckCircle, Zap, Gauge, Fuel, Users, ArrowRight, Battery, Timer, ArrowUpRight } from 'lucide-react';
import { z } from 'zod';

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

const VehicleSpecCard = ({ vehicle }: { vehicle: any }) => {
  if (!vehicle) return null;

  const isEV = vehicle.engine_type === 'electric';
  const isHybrid = vehicle.engine_type === 'hybrid';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-heading font-bold text-foreground text-lg">
            {vehicle.brand} {vehicle.model}
          </h4>
          <p className="text-sm text-muted-foreground">{vehicle.variant} · {vehicle.year}</p>
        </div>
        <Badge className={
          isEV ? 'bg-success/10 text-success border-success/20' :
          isHybrid ? 'bg-info/10 text-info border-info/20' :
          'bg-muted text-muted-foreground'
        }>
          {isEV ? '⚡ Electric' : isHybrid ? '🔄 Hybrid' : vehicle.fuel_type || 'Petrol'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {vehicle.horsepower && (
          <SpecItem icon={<Gauge className="h-4 w-4" />} label="Power" value={`${vehicle.horsepower} HP`} />
        )}
        {vehicle.torque && (
          <SpecItem icon={<ArrowUpRight className="h-4 w-4" />} label="Torque" value={vehicle.torque} />
        )}
        {vehicle.acceleration && (
          <SpecItem icon={<Timer className="h-4 w-4" />} label="0-100 km/h" value={vehicle.acceleration} />
        )}
        {vehicle.top_speed && (
          <SpecItem icon={<Zap className="h-4 w-4" />} label="Top Speed" value={vehicle.top_speed} />
        )}
        {isEV && vehicle.range_km && (
          <SpecItem icon={<Battery className="h-4 w-4" />} label="Range" value={`${vehicle.range_km} km`} highlight />
        )}
        {isEV && vehicle.battery_capacity && (
          <SpecItem icon={<Fuel className="h-4 w-4" />} label="Battery" value={vehicle.battery_capacity} />
        )}
        {!isEV && vehicle.mileage && (
          <SpecItem icon={<Fuel className="h-4 w-4" />} label="Mileage" value={vehicle.mileage} />
        )}
        {vehicle.transmission && (
          <SpecItem icon={<ArrowRight className="h-4 w-4" />} label="Transmission" value={vehicle.transmission} />
        )}
        {vehicle.seating_capacity && (
          <SpecItem icon={<Users className="h-4 w-4" />} label="Seats" value={`${vehicle.seating_capacity} Seater`} />
        )}
        {vehicle.drive_type && (
          <SpecItem icon={<Car className="h-4 w-4" />} label="Drive" value={vehicle.drive_type} />
        )}
      </div>

      {vehicle.color && (
        <p className="text-xs text-muted-foreground">Color: <span className="font-medium text-foreground">{vehicle.color}</span></p>
      )}
    </div>
  );
};

const SpecItem = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div className={`flex items-start gap-2 p-2.5 rounded-lg ${highlight ? 'bg-success/5 border border-success/15' : 'bg-muted/50'}`}>
    <div className={`mt-0.5 ${highlight ? 'text-success' : 'text-muted-foreground'}`}>{icon}</div>
    <div>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className={`text-sm font-medium leading-tight ${highlight ? 'text-success' : 'text-foreground'}`}>{value}</p>
    </div>
  </div>
);

const BookingPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', preferredContact: 'phone',
    locationId: '', vehicleId: '', scheduledDate: '', scheduledTime: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);

  useEffect(() => {
    supabase.from('locations').select('*').eq('is_active', true).then(({ data }) => setLocations(data || []));
  }, []);

  useEffect(() => {
    if (formData.locationId) {
      supabase.from('vehicles').select('*')
        .eq('location_id', formData.locationId)
        .eq('is_available', true)
        .eq('is_active', true)
        .then(({ data }) => setVehicles(data || []));
    }
  }, [formData.locationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = bookingSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        fieldErrors[err.path[0] as string] = err.message;
      });
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

      if (formData.preferredContact === 'email' && formData.email) {
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-confirmation',
            recipientEmail: formData.email,
            idempotencyKey: `booking-confirm-${tdData.id}`,
            templateData: { customerName: formData.fullName, vehicleName, locationName, scheduledDate: formData.scheduledDate, scheduledTime: formData.scheduledTime },
          },
        }).catch(err => console.error('Email send failed:', err));
      } else {
        const confirmationMsg = `✅ *Test Drive Confirmed!*\n\nHi ${formData.fullName},\n\nYour test drive has been booked:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n📅 *Date:* ${formData.scheduledDate}\n⏰ *Time:* ${formData.scheduledTime}\n\nPlease bring a valid driving license. See you there!\n\n— DriveSync`;
        supabase.functions.invoke('send-whatsapp', {
          body: { to: formData.phone, message: confirmationMsg, customerId, testDriveId: tdData.id, purpose: 'booking_confirmed' },
        }).catch(err => console.error('WhatsApp send failed:', err));
      }

      const notifType = formData.preferredContact === 'email' ? 'email' : 'WhatsApp';
      setSuccess(true);
      toast({ title: 'Test drive booked!', description: `You will receive a ${notifType} confirmation shortly.` });
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
            <p className="text-muted-foreground mb-4">We'll send you a confirmation shortly.</p>
            <Button onClick={() => { setSuccess(false); setFormData({ fullName: '', email: '', phone: '', preferredContact: 'phone', locationId: '', vehicleId: '', scheduledDate: '', scheduledTime: '' }); }}>
              Book Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // Group vehicles by type
  const evVehicles = vehicles.filter(v => v.engine_type === 'electric');
  const hybridVehicles = vehicles.filter(v => v.engine_type === 'hybrid');
  const iceVehicles = vehicles.filter(v => v.engine_type !== 'electric' && v.engine_type !== 'hybrid');

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-dark py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-primary-foreground">DriveSync</h1>
          </div>
          <p className="text-lg text-primary-foreground/70">Book your test drive experience</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto -mt-8 px-4 pb-12">
        <Card className="shadow-elevated animate-fade-in">
          <CardHeader>
            <CardTitle className="font-heading">Schedule a Test Drive</CardTitle>
            <CardDescription>Fill in your details to book a test drive</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} />
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
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredContact">Preferred Contact *</Label>
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

              <div className="space-y-2">
                <Label>Showroom Location *</Label>
                <Select value={formData.locationId} onValueChange={v => setFormData(p => ({ ...p, locationId: v, vehicleId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name} - {loc.city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.locationId && <p className="text-xs text-destructive">{errors.locationId}</p>}
              </div>

              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <Select value={formData.vehicleId} onValueChange={v => setFormData(p => ({ ...p, vehicleId: v }))} disabled={!formData.locationId}>
                  <SelectTrigger><SelectValue placeholder={formData.locationId ? 'Select a vehicle' : 'Select location first'} /></SelectTrigger>
                  <SelectContent>
                    {evVehicles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-success flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Electric Vehicles
                        </div>
                        {evVehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            ⚡ {v.brand} {v.model} {v.variant || ''} — {v.range_km}km range
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {hybridVehicles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-info flex items-center gap-1">
                          🔄 Hybrid Vehicles
                        </div>
                        {hybridVehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            🔄 {v.brand} {v.model} {v.variant || ''} ({v.mileage})
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {iceVehicles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          🏎️ Petrol / Diesel
                        </div>
                        {iceVehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.brand} {v.model} {v.variant || ''} ({v.color || v.year})
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {errors.vehicleId && <p className="text-xs text-destructive">{errors.vehicleId}</p>}
              </div>

              {/* Vehicle Specs Card */}
              {selectedVehicle && <VehicleSpecCard vehicle={selectedVehicle} />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred Date *</Label>
                  <Input id="date" type="date" min={minDate} value={formData.scheduledDate} onChange={e => setFormData(p => ({ ...p, scheduledDate: e.target.value }))} />
                  {errors.scheduledDate && <p className="text-xs text-destructive">{errors.scheduledDate}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Preferred Time *</Label>
                  <Input id="time" type="time" value={formData.scheduledTime} onChange={e => setFormData(p => ({ ...p, scheduledTime: e.target.value }))} />
                  {errors.scheduledTime && <p className="text-xs text-destructive">{errors.scheduledTime}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full gradient-primary border-0 text-primary-foreground" disabled={isSubmitting} size="lg">
                {isSubmitting ? 'Booking...' : 'Book Test Drive'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BookingPage;
