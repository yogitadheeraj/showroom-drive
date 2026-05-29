import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiDbQuery } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { CalendarCheck, Plus, Clock, User, Car } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/10 text-success',
  expired: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  converted: 'bg-primary/10 text-primary',
};

const VehicleReservations = () => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    customer_id: '',
    reservation_type: 'internal',
    reserved_until: '',
    deposit_amount: '0',
    notes: '',
  });
  const { toast } = useToast();
  const { profile } = useAuth();
  const { dealerId } = useDealerContext();

  useEffect(() => {
    fetchReservations();
    fetchVehicles();
    fetchCustomers();
  }, [dealerId]);

  const fetchReservations = async () => {
    const reservationData = await apiDbQuery<any[]>({
      table: 'vehicle_reservations',
      action: 'select',
      select: '*',
      order: [{ field: 'created_at', ascending: false }],
    });

    const vehicleIds = Array.from(new Set((reservationData || []).map((r) => r.vehicle_id).filter(Boolean)));
    const customerIds = Array.from(new Set((reservationData || []).map((r) => r.customer_id).filter(Boolean)));

    const [vehicles, customers] = await Promise.all([
      vehicleIds.length ? apiDbQuery<any[]>({ table: 'vehicles', action: 'select', select: 'id, brand, model, variant', filters: [{ field: 'id', op: 'in', value: vehicleIds }] }) : Promise.resolve([]),
      customerIds.length ? apiDbQuery<any[]>({ table: 'customers', action: 'select', select: 'id, full_name, phone', filters: [{ field: 'id', op: 'in', value: customerIds }] }) : Promise.resolve([]),
    ]);

    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    setReservations(
      (reservationData || []).map((r) => ({
        ...r,
        vehicles: vehicleMap.get(r.vehicle_id) || null,
        customers: customerMap.get(r.customer_id) || null,
      }))
    );
  };

  const fetchVehicles = async () => {
    const data = await apiDbQuery<any[]>({
      table: 'vehicles',
      action: 'select',
      select: 'id, brand, model, variant, location_id, locations(dealer_id)',
      filters: [{ field: 'is_active', op: 'eq', value: true }],
    });
    let filtered = data || [];
    if (dealerId) filtered = filtered.filter((v: any) => v.locations?.dealer_id === dealerId);
    setVehicles(filtered);
  };

  const fetchCustomers = async () => {
    const data = await apiDbQuery<any[]>({
      table: 'customers',
      action: 'select',
      select: 'id, full_name, phone',
      order: [{ field: 'full_name', ascending: true }],
      limit: 200,
    });
    setCustomers(data || []);
  };

  const handleCreate = async () => {
    if (!formData.vehicle_id || !formData.reserved_until) {
      toast({ title: 'Vehicle and end date are required', variant: 'destructive' });
      return;
    }
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
    await apiDbQuery({
      table: 'vehicle_reservations',
      action: 'insert',
      payload: {
        vehicle_id: formData.vehicle_id,
        customer_id: formData.customer_id || null,
        reserved_by_profile_id: profile?.id || null,
        location_id: vehicle?.location_id,
        reservation_type: formData.reservation_type,
        reserved_until: new Date(formData.reserved_until).toISOString(),
        deposit_amount: parseFloat(formData.deposit_amount) || 0,
        notes: formData.notes || null,
      },
    });

    toast({ title: 'Reservation created' });
    setShowDialog(false);
    fetchReservations();
  };

  const handleCancel = async (id: string) => {
    await apiDbQuery({
      table: 'vehicle_reservations',
      action: 'update',
      payload: { status: 'cancelled' },
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    toast({ title: 'Reservation cancelled' });
    fetchReservations();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-heading flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Vehicle Reservations
        </CardTitle>
        <Button onClick={() => { setFormData({ vehicle_id: '', customer_id: '', reservation_type: 'internal', reserved_until: '', deposit_amount: '0', notes: '' }); setShowDialog(true); }} className="bg-success text-success-foreground hover:bg-success/90">
          <Plus className="h-4 w-4 mr-2" /> New Reservation
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Until</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reservations found</TableCell></TableRow>
              )}
              {reservations.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      {r.vehicles?.brand} {r.vehicles?.model} {r.vehicles?.variant || ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {r.customers?.full_name || '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.reservation_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {format(new Date(r.reserved_until), 'dd MMM yyyy, HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell>₹{Number(r.deposit_amount).toLocaleString()}</TableCell>
                  <TableCell>
                    {r.status === 'active' && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleCancel(r.id)}>Cancel</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">New Vehicle Reservation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <Select value={formData.vehicle_id} onValueChange={v => setFormData(p => ({ ...p, vehicle_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.variant || ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={formData.customer_id} onValueChange={v => setFormData(p => ({ ...p, customer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select customer (optional)" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.reservation_type} onValueChange={v => setFormData(p => ({ ...p, reservation_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal (Staff)</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deposit (₹)</Label>
                  <Input type="number" value={formData.deposit_amount} onChange={e => setFormData(p => ({ ...p, deposit_amount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reserved Until *</Label>
                <Input type="datetime-local" value={formData.reserved_until} onChange={e => setFormData(p => ({ ...p, reserved_until: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
              <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">Create Reservation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default VehicleReservations;
