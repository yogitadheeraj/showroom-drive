import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { Plus, MapPin, Pencil, Clock, Phone, Mail, Smartphone, Monitor, Trash2, ChevronRight, Users, Calendar, AlertCircle, Lock } from 'lucide-react';

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
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { role } = useAuth();
  
  // Device management states
  const [deviceDialog, setDeviceDialog] = useState<string | null>(null);
  const [devices, setDevices] = useState<Record<string, any[]>>({});
  const [newDevice, setNewDevice] = useState({ name: '', device_type: 'tablet', serial_number: '', notes: '' });
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [testDriveCounts, setTestDriveCounts] = useState<Record<string, number>>({});
  
  // Test drive schedule states
  const [scheduleDialog, setScheduleDialog] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Record<string, any[]>>({});
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState<any>(null);

  // Check if user can manage schedules
  const canManageSchedules = [APP_ROLE.GRO, APP_ROLE.DEALER_ADMIN].includes(role);

  useEffect(() => {
    if (!dealerLoading) fetchLocations();
  }, [dealerId, dealerLoading]);

  const fetchLocations = async () => {
    let query = supabase.from('locations').select('*').order('name');
    if (dealerId) query = query.eq('dealer_id', dealerId);
    const { data } = await query;
    setLocations(data || []);
    
    // Fetch related data for each location
    if (data) {
      data.forEach(loc => {
        fetchDevices(loc.id);
        fetchStaffCount(loc.id);
        fetchTestDriveCount(loc.id);
      });
    }
  };

  const fetchDevices = async (locationId: string) => {
    const { data } = await supabase.from('location_devices').select('*').eq('location_id', locationId).order('created_at', { ascending: false });
    setDevices(prev => ({ ...prev, [locationId]: data || [] }));
  };

  const fetchStaffCount = async (locationId: string) => {
    try {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('location_id', locationId).neq('app_role', 'admin');
      setStaffCounts(prev => ({ ...prev, [locationId]: count || 0 }));
    } catch (err) {
      console.error('Error fetching staff count:', err);
      setStaffCounts(prev => ({ ...prev, [locationId]: 0 }));
    }
  };

  const fetchTestDriveCount = async (locationId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('test_drives').select('id', { count: 'exact', head: true }).eq('location_id', locationId).eq('scheduled_date', today).in('status', ['confirmed', 'show', 'in_progress']);
      setTestDriveCounts(prev => ({ ...prev, [locationId]: count || 0 }));
    } catch (err) {
      console.error('Error fetching test drive count:', err);
      setTestDriveCounts(prev => ({ ...prev, [locationId]: 0 }));
    }
  };

  const fetchSchedules = async (locationId: string) => {
    const { data } = await supabase.from('test_drives').select('id, scheduled_date, scheduled_time, status').eq('location_id', locationId).gte('scheduled_date', new Date().toISOString().split('T')[0]).order('scheduled_date').order('scheduled_time');
    setSchedules(prev => ({ ...prev, [locationId]: data || [] }));
  };

  const openScheduleDialog = (locationId: string) => {
    fetchSchedules(locationId);
    setScheduleDialog(locationId);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address || !formData.city) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    const payload = { ...formData, dealer_id: dealerId };
    if (editingId) {
      await supabase.from('locations').update(formData).eq('id', editingId);
      toast({ title: 'Location updated' });
    } else {
      await supabase.from('locations').insert(payload);
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
        const row = { location_id: hoursDialog, day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time, is_closed: h.is_closed };
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
    } finally { setSavingHours(false); }
  };

  const openDeviceDialog = (locationId: string) => {
    setDeviceDialog(locationId);
    setNewDevice({ name: '', device_type: 'tablet', serial_number: '', notes: '' });
  };

  const addDevice = async () => {
    if (!deviceDialog || !newDevice.name) {
      toast({ title: 'Device name is required', variant: 'destructive' });
      return;
    }
    
    try {
      await supabase.from('location_devices').insert({
        location_id: deviceDialog,
        name: newDevice.name,
        device_type: newDevice.device_type,
        serial_number: newDevice.serial_number || null,
        notes: newDevice.notes || null,
        is_active: true
      });
      
      toast({ title: 'Device added successfully' });
      fetchDevices(deviceDialog);
      setDeviceDialog(null);
      setNewDevice({ name: '', device_type: 'tablet', serial_number: '', notes: '' });
    } catch (err: any) {
      toast({ title: 'Failed to add device', description: err.message, variant: 'destructive' });
    }
  };

  const deleteDevice = async (locationId: string, deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    try {
      await supabase.from('location_devices').delete().eq('id', deviceId);
      toast({ title: 'Device deleted' });
      fetchDevices(locationId);
    } catch (err: any) {
      toast({ title: 'Failed to delete device', description: err.message, variant: 'destructive' });
    }
  };

  const toggleDevice = async (locationId: string, deviceId: string, isActive: boolean) => {
    try {
      await supabase.from('location_devices').update({ is_active: !isActive }).eq('id', deviceId);
      fetchDevices(locationId);
    } catch (err: any) {
      toast({ title: 'Failed to update device', variant: 'destructive' });
    }
  };

  const hoursLocationName = locations.find(l => l.id === hoursDialog)?.name || '';

  if (dealerLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">Locations</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your dealership locations and devices</p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormData({ name: '', address: '', city: '', state: '', phone: '', email: '' }); setShowDialog(true); }}
            className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </div>

        {locations.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 sm:p-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No locations yet. Create your first location to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {locations.map(loc => (
              <Card key={loc.id} className="shadow-card hover:shadow-elevated transition-shadow overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">{loc.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">{loc.address}</p>
                        <p className="text-xs text-muted-foreground">{loc.city}{loc.state ? `, ${loc.state}` : ''}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => editLocation(loc)} title="Edit Location">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-primary/10 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-muted-foreground">Today's Drives</div>
                      <div className="text-xl font-bold text-primary mt-0.5">{testDriveCounts[loc.id] || 0}</div>
                    </div>
                    <div className="bg-success/10 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-muted-foreground">Staff</div>
                      <div className="text-xl font-bold text-success mt-0.5">{staffCounts[loc.id] || 0}</div>
                    </div>
                    <div className="bg-info/10 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-muted-foreground">Devices</div>
                      <div className="text-xl font-bold text-info mt-0.5">{devices[loc.id]?.length || 0}</div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
                    {loc.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{loc.phone}</span>}
                    {loc.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{loc.email}</span>}
                  </div>

                  {/* Device List */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-info" /> Devices
                      </h4>
                      <Button size="sm" className="h-7 px-2 bg-info text-info-foreground hover:bg-info/90" onClick={() => openDeviceDialog(loc.id)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {devices[loc.id]?.length ? (
                      <div className="space-y-1.5">
                        {devices[loc.id].map(dev => (
                          <div key={dev.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium">{dev.name}</p>
                                <p className="text-muted-foreground">{dev.device_type}{dev.serial_number ? ` • ${dev.serial_number}` : ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant={dev.is_active ? 'default' : 'secondary'} className="text-xs">
                                {dev.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Button size="sm" className="h-6 w-6 p-0 hover:bg-destructive/20" onClick={() => deleteDevice(loc.id, dev.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No devices yet</p>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="border-t border-border pt-3">
                    {canManageSchedules ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-info text-info-foreground hover:bg-info/90 text-xs" onClick={() => openHoursDialog(loc.id)}>
                          <Clock className="h-3.5 w-3.5 mr-1.5" /> Hours
                        </Button>
                        <Button size="sm" className="flex-1 bg-primary/50 text-primary-foreground hover:bg-primary/60 text-xs" onClick={() => openScheduleDialog(loc.id)}>
                          <Calendar className="h-3.5 w-3.5 mr-1.5" /> Schedule
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded bg-muted/50">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">GRO/Admin only</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit' : 'Add'} Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address *</Label><Input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2"><Label>City *</Label><Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <Button onClick={handleSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{editingId ? 'Update' : 'Add'} Location</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Operating Hours Dialog */}
        <Dialog open={!!hoursDialog} onOpenChange={() => setHoursDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Hours — {hoursLocationName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 sm:space-y-3 p-10">
              {hours.map((h, i) => (
                <div key={i} className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors ${h.is_closed ? 'bg-muted/50 border-border' : 'bg-card border-border'}`}>
                  <div className="w-full sm:w-24 flex items-center justify-between sm:block">
                    <span className={`text-sm font-medium ${h.is_closed ? 'text-muted-foreground' : 'text-foreground'}`}>{DAYS[i]}</span>
                    <div className="flex items-center gap-2 sm:hidden">
                      <Switch checked={!h.is_closed} onCheckedChange={(v) => updateHourField(i, 'is_closed', !v)} />
                      <span className="text-xs text-muted-foreground">{h.is_closed ? 'Closed' : 'Open'}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Switch checked={!h.is_closed} onCheckedChange={(v) => updateHourField(i, 'is_closed', !v)} />
                    <span className="text-xs text-muted-foreground w-10">{h.is_closed ? 'Closed' : 'Open'}</span>
                  </div>
                  {!h.is_closed && (
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                      <Input type="time" value={h.open_time?.substring(0, 5) || '09:00'}
                        onChange={e => updateHourField(i, 'open_time', e.target.value)}
                        className="flex-1 sm:w-28 h-8 text-xs" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" value={h.close_time?.substring(0, 5) || '19:00'}
                        onChange={e => updateHourField(i, 'close_time', e.target.value)}
                        className="flex-1 sm:w-28 h-8 text-xs" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={saveHours} disabled={savingHours} className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {savingHours ? 'Saving...' : 'Save Hours'}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Add Device Dialog */}
        <Dialog open={!!deviceDialog} onOpenChange={() => setDeviceDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Device</DialogTitle>
              <DialogDescription>Register a new device for this location</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Device Name *</Label>
                <Input 
                  placeholder="e.g., Tablet 1, Check-in Kiosk" 
                  value={newDevice.name}
                  onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Device Type</Label>
                <select 
                  className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm bg-background"
                  value={newDevice.device_type}
                  onChange={e => setNewDevice(p => ({ ...p, device_type: e.target.value }))}
                >
                  <option value="tablet">Tablet</option>
                  <option value="laptop">Laptop</option>
                  <option value="desktop">Desktop</option>
                  <option value="kiosk">Kiosk</option>
                  <option value="printer">Printer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input 
                  placeholder="Device serial or asset number" 
                  value={newDevice.serial_number}
                  onChange={e => setNewDevice(p => ({ ...p, serial_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Any additional notes..."
                  value={newDevice.notes}
                  onChange={e => setNewDevice(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeviceDialog(null)}>Cancel</Button>
              <Button onClick={addDevice} className="bg-primary text-primary-foreground hover:bg-primary/90">Add Device</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Drive Schedule Dialog */}
        <Dialog open={!!scheduleDialog} onOpenChange={() => setScheduleDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Test Drive Schedule — {locations.find(l => l.id === scheduleDialog)?.name}
              </DialogTitle>
              <DialogDescription>View upcoming test drives at this location</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2">
              {schedules[scheduleDialog]?.length ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {schedules[scheduleDialog].map((drive: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{drive.scheduled_date}</p>
                        <p className="text-xs text-muted-foreground">{drive.scheduled_time}</p>
                      </div>
                      <Badge variant={
                        drive.status === 'completed' ? 'secondary' :
                        drive.status === 'in_progress' ? 'default' :
                        drive.status === 'confirmed' ? 'outline' : 'secondary'
                      } className="text-xs">
                        {drive.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground text-sm">No upcoming test drives scheduled</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button onClick={() => setScheduleDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LocationsPage;
