import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Pencil } from 'lucide-react';

const LocationsPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', phone: '', email: '' });
  const { toast } = useToast();

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('name');
    setLocations(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address || !formData.city) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    if (editingId) {
      await supabase.from('locations').update(formData).eq('id', editingId);
      toast({ title: 'Location updated' });
    } else {
      await supabase.from('locations').insert(formData);
      toast({ title: 'Location added' });
    }
    setShowDialog(false);
    setEditingId(null);
    setFormData({ name: '', address: '', city: '', state: '', phone: '', email: '' });
    fetchLocations();
  };

  const editLocation = (loc: any) => {
    setEditingId(loc.id);
    setFormData({ name: loc.name, address: loc.address, city: loc.city, state: loc.state || '', phone: loc.phone || '', email: loc.email || '' });
    setShowDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-foreground">Locations</h1>
          <Button onClick={() => { setEditingId(null); setFormData({ name: '', address: '', city: '', state: '', phone: '', email: '' }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => (
            <Card key={loc.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-foreground">{loc.name}</h3>
                      <p className="text-sm text-muted-foreground">{loc.city}{loc.state ? `, ${loc.state}` : ''}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => editLocation(loc)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{loc.address}</p>
                {loc.phone && <p className="text-sm text-muted-foreground mt-1">{loc.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit' : 'Add'} Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address *</Label><Input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>City *</Label><Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <Button onClick={handleSubmit} className="w-full">{editingId ? 'Update' : 'Add'} Location</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LocationsPage;
