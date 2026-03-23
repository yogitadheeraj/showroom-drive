import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const WalkinPage = () => {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', preferredContact: 'phone',
    locationId: profile?.location_id || '', vehicleId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.vehicleId || !formData.locationId) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
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

      const now = new Date();
      const { error } = await supabase.from('test_drives').insert({
        customer_id: customerId, vehicle_id: formData.vehicleId,
        location_id: formData.locationId,
        scheduled_date: now.toISOString().split('T')[0],
        scheduled_time: now.toTimeString().slice(0, 5),
        source: 'walkin', status: 'show' as any,
      });
      if (error) throw error;

      toast({ title: 'Walk-in registered', description: `${formData.fullName} checked in for test drive` });
      setFormData({ fullName: '', phone: '', email: '', preferredContact: 'phone', locationId: profile?.location_id || '', vehicleId: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Walk-in Registration</h1>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Register Walk-in Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
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
              <div className="space-y-2">
                <Label>Location *</Label>
                <Select value={formData.locationId} onValueChange={v => setFormData(p => ({ ...p, locationId: v, vehicleId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <Select value={formData.vehicleId} onValueChange={v => setFormData(p => ({ ...p, vehicleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.color})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register Walk-in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WalkinPage;
