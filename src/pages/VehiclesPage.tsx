import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Car } from 'lucide-react';

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    brand: '', model: '', variant: '', year: new Date().getFullYear().toString(),
    color: '', registration_number: '', location_id: '', image_url: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicles();
    supabase.from('locations').select('*').eq('is_active', true).then(({ data }) => setLocations(data || []));
  }, []);

  const fetchVehicles = async () => {
    const { data } = await supabase.from('vehicles').select('*, locations(name)').eq('is_active', true).order('brand');
    setVehicles(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.brand || !formData.model || !formData.location_id) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    await supabase.from('vehicles').insert({
      ...formData,
      year: parseInt(formData.year),
      variant: formData.variant || null,
      color: formData.color || null,
      registration_number: formData.registration_number || null,
      image_url: formData.image_url || null,
    });
    toast({ title: 'Vehicle added' });
    setShowDialog(false);
    setFormData({ brand: '', model: '', variant: '', year: new Date().getFullYear().toString(), color: '', registration_number: '', location_id: '', image_url: '' });
    fetchVehicles();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-foreground">Vehicles</h1>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Vehicle
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => (
            <Card key={v.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Car className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-foreground">{v.brand} {v.model}</h3>
                      <p className="text-sm text-muted-foreground">{v.variant || ''} {v.year}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={v.is_available ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                    {v.is_available ? 'Available' : 'In Use'}
                  </Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground space-y-1">
                  {v.color && <p>Color: {v.color}</p>}
                  {v.registration_number && <p>Reg: {v.registration_number}</p>}
                  <p>Location: {v.locations?.name}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Brand *</Label><Input value={formData.brand} onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Model *</Label><Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Variant</Label><Input value={formData.variant} onChange={e => setFormData(p => ({ ...p, variant: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Year</Label><Input type="number" value={formData.year} onChange={e => setFormData(p => ({ ...p, year: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Color</Label><Input value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Registration</Label><Input value={formData.registration_number} onChange={e => setFormData(p => ({ ...p, registration_number: e.target.value }))} /></div>
              </div>
              <div className="space-y-2">
                <Label>Location *</Label>
                <Select value={formData.location_id} onValueChange={v => setFormData(p => ({ ...p, location_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Image URL</Label><Input value={formData.image_url} onChange={e => setFormData(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." /></div>
              <Button onClick={handleSubmit} className="w-full">Add Vehicle</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default VehiclesPage;
