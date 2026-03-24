import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Pencil, Clock } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LocationsPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', phone: '', email: '' });
  const [hoursDialog, setHoursDialog] = useState<string | null>(null);
  const [hours, setHours] = useState<any[]>([]);
  const [savingHours, setSavingHours] = useState(false);
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

  const openHoursDialog = async (locationId: string) => {
    const { data } = await supabase.from('location_operating_hours').select('*').eq('location_id', locationId).order('day_of_week');
    // Build full 7-day array, filling defaults for missing days
    const fullHours = DAYS.map((_, i) => {
      const existing = data?.find(d => d.day_of_week === i);
      return existing || { location_id: locationId, day_of_week: i, open_time: '09:00', close_time: '19:00', is_closed: false, id: null };
    });
    setHours(fullHours);
    setHoursDialog(locationId);
  };

  const updateHourField = (dayIndex: number, field: string, value: any) => {
    setHours(prev => prev.map((h, i) => i === dayIndex ? { ...h, [field]: value } : h));
  };

  const saveHours = async () => {
    if (!hoursDialog) return;
    setSavingHours(true);
    try {
      for (const h of hours) {
        const row = {
          location_id: hoursDialog,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
        };
        if (h.id) {
          await supabase.from('location_operating_hours').update(row).eq('id', h.id);
        } else {
          await supabase.from('location_operating_hours').insert(row);
        }
      }
      toast({ title: 'Operating hours saved' });
      setHoursDialog(null);
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSavingHours(false);
    }
  };

  const hoursLocationName = locations.find(l => l.id === hoursDialog)?.name || '';

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
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openHoursDialog(loc.id)} title="Operating Hours">
                      <Clock className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => editLocation(loc)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{loc.address}</p>
                {loc.phone && <p className="text-sm text-muted-foreground mt-1">{loc.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add/Edit Location Dialog */}
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

        {/* Operating Hours Dialog */}
        <Dialog open={!!hoursDialog} onOpenChange={() => setHoursDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Operating Hours — {hoursLocationName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {hours.map((h, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${h.is_closed ? 'bg-muted/50 border-border' : 'bg-card border-border'}`}>
                  <div className="w-24 shrink-0">
                    <span className={`text-sm font-medium ${h.is_closed ? 'text-muted-foreground' : 'text-foreground'}`}>{DAYS[i]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!h.is_closed} onCheckedChange={(v) => updateHourField(i, 'is_closed', !v)} />
                    <span className="text-xs text-muted-foreground w-10">{h.is_closed ? 'Closed' : 'Open'}</span>
                  </div>
                  {!h.is_closed && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Input type="time" value={h.open_time?.substring(0, 5) || '09:00'}
                        onChange={e => updateHourField(i, 'open_time', e.target.value)}
                        className="w-28 h-8 text-xs" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" value={h.close_time?.substring(0, 5) || '19:00'}
                        onChange={e => updateHourField(i, 'close_time', e.target.value)}
                        className="w-28 h-8 text-xs" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={saveHours} disabled={savingHours} className="w-full mt-2">
              {savingHours ? 'Saving...' : 'Save Hours'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LocationsPage;
