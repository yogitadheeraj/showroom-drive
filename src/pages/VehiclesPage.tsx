import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Car, Edit2 } from 'lucide-react';

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: '', model: '', variant: '', year: new Date().getFullYear().toString(),
    color: '', registration_number: '', location_id: '', image_url: '',
    total_units: '1', available_units: '1',
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

  const openEdit = (v: any) => {
    setEditingId(v.id);
    setFormData({
      brand: v.brand, model: v.model, variant: v.variant || '', year: String(v.year),
      color: v.color || '', registration_number: v.registration_number || '',
      location_id: v.location_id, image_url: v.image_url || '',
      total_units: String(v.total_units || 1), available_units: String(v.available_units || 1),
    });
    setShowDialog(true);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({ brand: '', model: '', variant: '', year: new Date().getFullYear().toString(), color: '', registration_number: '', location_id: '', image_url: '', total_units: '1', available_units: '1' });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.brand || !formData.model || !formData.location_id) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    const payload = {
      brand: formData.brand, model: formData.model,
      variant: formData.variant || null, year: parseInt(formData.year),
      color: formData.color || null, registration_number: formData.registration_number || null,
      location_id: formData.location_id, image_url: formData.image_url || null,
      total_units: parseInt(formData.total_units) || 1,
      available_units: parseInt(formData.available_units) || 1,
    };

    if (editingId) {
      await supabase.from('vehicles').update(payload).eq('id', editingId);
      toast({ title: 'Vehicle updated' });
    } else {
      await supabase.from('vehicles').insert(payload);
      toast({ title: 'Vehicle added' });
    }
    setShowDialog(false);
    fetchVehicles();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-foreground">Vehicles</h1>
          <Button onClick={openNew}>
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={v.available_units > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                      {v.available_units}/{v.total_units} available
                    </Badge>
                    <button onClick={() => openEdit(v)} className="h-7 w-7 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
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
              <DialogTitle className="font-heading">{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
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
                <div className="space-y-2"><Label>Total Units</Label><Input type="number" min="1" value={formData.total_units} onChange={e => setFormData(p => ({ ...p, total_units: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Available Units</Label><Input type="number" min="0" value={formData.available_units} onChange={e => setFormData(p => ({ ...p, available_units: e.target.value }))} /></div>
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
              <Button onClick={handleSubmit} className="w-full">{editingId ? 'Update Vehicle' : 'Add Vehicle'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default VehiclesPage;
