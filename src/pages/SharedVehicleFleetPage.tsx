import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import TransitRequestsPanel from '@/components/TransitRequestsPanel';
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { APP_ROLE } from '@/constants/roles';
import {
  Car, MapPin, Navigation, Clock, RefreshCw, ArrowRight,
  CheckCircle, Truck, AlertTriangle, CalendarClock, PlusCircle,
  XCircle, Loader2, User, UserCheck,
} from 'lucide-react';

type TransitStatus = 'scheduled' | 'in_transit' | 'arrived' | 'cancelled';

interface FleetVehicle {
  id: string;
  brand: string;
  model: string;
  variant?: string;
  color?: string;
  registration_number?: string;
  is_shared: boolean;
  transit_status: string;
  transit_eta?: string | null;
  transit_to_location_id?: string | null;
  current_location?: { id: string; name: string; city?: string } | null;
  home_location?: { id: string; name: string; city?: string } | null;
  active_transits: ActiveTransit[];
  upcoming_drives: UpcomingDrive[];
}

interface ActiveTransit {
  id: string;
  from_location_id: string;
  to_location_id: string;
  status: TransitStatus;
  distance_km: number | null;
  transit_minutes: number | null;
  depart_time: string;
  eta_time: string;
  trigger: string;
  notes?: string | null;
  scheduled_by_profile_id?: string | null;
  receiver_profile_id?: string | null;
  receiver_name?: string | null;
  receiver_assigned_at?: string | null;
  received_notes?: string | null;
}

interface UpcomingDrive {
  id: string;
  location_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
}

const TRANSIT_COLOR: Record<TransitStatus, string> = {
  scheduled:  'bg-amber-100 text-amber-700 border-amber-200',
  in_transit: 'bg-blue-100 text-blue-700 border-blue-200',
  arrived:    'bg-green-100 text-green-700 border-green-200',
  cancelled:  'bg-red-100 text-red-700 border-red-200',
};

const formatMinutes = (m: number | null) => {
  if (m === null) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ─────────────────────────────────────────────────────────────────────────────

export default function SharedVehicleFleetPage() {
  const { role } = useAuth();
  const { dealerId } = useDealerContext();
  const { toast } = useToast();
  const { profile } = useAuth();

  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);

  // Dispatch dialog state
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchVehicle, setDispatchVehicle] = useState<FleetVehicle | null>(null);
  const [dispatchTo, setDispatchTo] = useState('');
  const [dispatchFrom, setDispatchFrom] = useState('');
  const [dispatchTime, setDispatchTime] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Assign-receiver dialog state
  const [assignReceiverTransit, setAssignReceiverTransit] = useState<ActiveTransit | null>(null);
  const [securityList, setSecurityList] = useState<any[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  // Receiver name map (profileId → name) for quick lookup
  const [receiverNames, setReceiverNames] = useState<Record<string, string>>({});

  // Mark-received dialog state
  const [receiveTransit, setReceiveTransit] = useState<ActiveTransit | null>(null);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);

  // Admins: full fleet control (dispatch, arrive, cancel, assign receiver, schedule transit)
  const canManage = [APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN, APP_ROLE.SUPERADMIN].includes(role as any);
  // Security: can schedule transit + assign receiver at destination — cannot dispatch/arrive/cancel
  const isSecurityRole = role === APP_ROLE.SECURITY;

  const loadFleet = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dealerId) params.set('dealer_id', dealerId);
      if (profile?.location_id) params.set('location_id', profile.location_id);
      const query = params.toString() ? `?${params}` : '';
      const data = await apiGet<FleetVehicle[]>(`/api/fleet/overview${query}`);
      setFleet(data || []);
    } finally {
      setLoading(false);
    }
  }, [dealerId, profile?.location_id]);

  const loadLocations = useCallback(async () => {
    const data = await apiGet<any[]>('/api/locations');
    setLocations(data || []);
  }, []);

  useEffect(() => {
    loadFleet();
    loadLocations();
  }, [loadFleet, loadLocations]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const openDispatch = (vehicle: FleetVehicle) => {
    setDispatchVehicle(vehicle);
    setDispatchFrom(vehicle.current_location?.id || '');
    setDispatchTo('');
    setDispatchTime(new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16));
    setDispatchNotes('');
    setDispatchOpen(true);
  };

  const handleDispatch = async () => {
    if (!dispatchVehicle || !dispatchTo || !dispatchFrom) return;
    setIsSending(true);
    try {
      await apiPost('/api/fleet/transits', {
        vehicle_id: dispatchVehicle.id,
        from_location_id: dispatchFrom,
        to_location_id: dispatchTo,
        depart_time: dispatchTime ? new Date(dispatchTime).toISOString() : new Date().toISOString(),
        notes: dispatchNotes || null,
        scheduled_by_profile_id: profile?.id ?? null,
      });
      toast({ title: 'Transit scheduled', description: `${dispatchVehicle.brand} ${dispatchVehicle.model} will be dispatched.` });
      setDispatchOpen(false);
      loadFleet();
    } catch (err: any) {
      toast({ title: 'Failed to schedule transit', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleTransitAction = async (transitId: string, action: 'dispatch' | 'arrive' | 'cancel') => {
    try {
      await apiPatch(`/api/fleet/transits/${encodeURIComponent(transitId)}/${action}`, {});
      toast({ title: action === 'arrive' ? 'Marked as arrived' : action === 'dispatch' ? 'Dispatched' : 'Cancelled' });
      loadFleet();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    }
  };

  const openAssignReceiver = async (transit: ActiveTransit) => {
    setAssignReceiverTransit(transit);
    setSelectedReceiver(transit.receiver_profile_id || '');
    const sec = await apiGet<any[]>(`/api/fleet/locations/${transit.to_location_id}/security`);
    setSecurityList(sec || []);
  };

  const handleAssignReceiver = async () => {
    if (!assignReceiverTransit || !selectedReceiver) return;
    setIsAssigning(true);
    try {
      await apiPatch(`/api/fleet/transits/${encodeURIComponent(assignReceiverTransit.id)}/assign-receiver`, { profile_id: selectedReceiver });
      const chosen = securityList.find(s => s.id === selectedReceiver);
      if (chosen) setReceiverNames(prev => ({ ...prev, [selectedReceiver]: chosen.full_name }));
      toast({ title: 'Receiver assigned', description: `${chosen?.full_name ?? 'Security staff'} will receive the vehicle.` });
      setAssignReceiverTransit(null);
      loadFleet();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!receiveTransit || !profile?.id) return;
    setIsReceiving(true);
    try {
      await apiPatch(`/api/fleet/transits/${encodeURIComponent(receiveTransit.id)}/receive`, {
        profile_id: profile.id,
        notes: receiveNotes || null,
      });
      toast({ title: 'Vehicle received', description: 'Transit marked as received.' });
      setReceiveTransit(null);
      loadFleet();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsReceiving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" /> Shared Vehicle Fleet
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-sm text-muted-foreground">Track shared demo vehicles rotating across showroom locations</p>
              {profile?.location_id && (
                <Badge className="text-[11px] gap-1 bg-primary/10 text-primary border-primary/20">
                  <MapPin className="h-3 w-3" />
                  {locations.find(l => l.id === profile.location_id)?.name ?? profile.location_id}
                </Badge>
              )}
              {role && (
                <Badge variant="outline" className="text-[11px] capitalize text-muted-foreground">
                  {String(role).replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={loadFleet} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Summary bar */}
        {!loading && fleet.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Shared', value: fleet.length, icon: Car, color: 'text-primary' },
              { label: 'At Location', value: fleet.filter(v => v.transit_status === 'at_location').length, icon: CheckCircle, color: 'text-success' },
              { label: 'In Transit', value: fleet.filter(v => v.transit_status === 'in_transit').length, icon: Navigation, color: 'text-info' },
              { label: 'Drives Today', value: fleet.reduce((s, v) => s + v.upcoming_drives.filter(d => d.scheduled_date === new Date().toISOString().split('T')[0]).length, 0), icon: CalendarClock, color: 'text-warning' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="shadow-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${color} shrink-0`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Loading fleet…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && fleet.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center space-y-3">
              <Truck className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-semibold text-foreground">No shared vehicles found</p>
              <p className="text-sm text-muted-foreground">
                Mark a demo vehicle as <strong>Shared</strong> (toggle <code>is_shared = true</code>) to add it to the fleet rotation.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Fleet cards */}
        {!loading && fleet.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {fleet.map((vehicle) => {
              const isInTransit = vehicle.transit_status === 'in_transit' || (vehicle.active_transits?.length > 0);
              const activeTransit = vehicle.active_transits?.[0] ?? null;

              return (
                <Card key={vehicle.id} className={`shadow-card ${isInTransit ? 'border-info/30 bg-info/5' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Car className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-heading">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.variant && <span className="text-muted-foreground font-normal text-sm"> {vehicle.variant}</span>}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {vehicle.color && <span className="text-xs text-muted-foreground">{vehicle.color}</span>}
                            {vehicle.registration_number && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{vehicle.registration_number}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge className={`text-xs shrink-0 ${isInTransit ? TRANSIT_COLOR.in_transit : 'bg-success/10 text-success border-success/20'}`}>
                        {isInTransit ? (activeTransit?.status === 'scheduled' ? 'Scheduled Transit' : 'In Transit') : 'At Location'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    {/* Current location */}
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{vehicle.current_location?.name ?? '—'}</span>
                      {vehicle.current_location?.city && (
                        <span className="text-muted-foreground text-xs">{vehicle.current_location.city}</span>
                      )}
                      {vehicle.home_location?.id !== vehicle.current_location?.id && vehicle.home_location && (
                        <Badge variant="outline" className="text-[10px] px-1.5 ml-1">
                          Home: {vehicle.home_location.name}
                        </Badge>
                      )}
                    </div>

                    {/* Active transit card */}
                    {activeTransit && (
                      <div className={`rounded-lg border p-3 space-y-2 ${TRANSIT_COLOR[activeTransit.status] || 'bg-muted'}`}>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Navigation className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {locations.find(l => l.id === activeTransit.from_location_id)?.name ?? activeTransit.from_location_id}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span>
                            {locations.find(l => l.id === activeTransit.to_location_id)?.name ?? activeTransit.to_location_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] flex-wrap">
                          {activeTransit.distance_km != null && (
                            <span className="flex items-center gap-1">
                              <Navigation className="h-3 w-3" /> {activeTransit.distance_km} km
                            </span>
                          )}
                          {activeTransit.transit_minutes != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> ~{formatMinutes(activeTransit.transit_minutes)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            ETA: {fmtDate(activeTransit.eta_time)} {fmtTime(activeTransit.eta_time)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {activeTransit.trigger}
                          </Badge>
                        </div>

                        {/* Receiver row */}
                        <div className={`flex items-center justify-between gap-2 text-[11px] rounded-md px-2 py-1.5 ${activeTransit.receiver_profile_id ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20'}`}>
                          <span className="flex items-center gap-1.5">
                            <UserCheck className={`h-3 w-3 shrink-0 ${activeTransit.receiver_profile_id ? 'text-success' : 'text-warning'}`} />
                            {activeTransit.receiver_profile_id
                              ? <span className="text-success font-medium">Receiver: {activeTransit.receiver_name ?? receiverNames[activeTransit.receiver_profile_id] ?? activeTransit.receiver_profile_id.slice(-6)}</span>
                              : <span className="text-warning font-medium">No receiver assigned</span>}
                          </span>
                          {(canManage || isSecurityRole) && (profile?.location_id === activeTransit.from_location_id) && (
                            <Button size="sm" variant="ghost" className="text-[10px] h-5 px-1.5 text-muted-foreground hover:text-foreground" onClick={() => openAssignReceiver(activeTransit)}>
                              <User className="h-3 w-3 mr-0.5" /> {activeTransit.receiver_profile_id ? 'Re-assign' : 'Assign'}
                            </Button>
                          )}
                        </div>

                        {/* Dispatch + Cancel: sender only (+ admin override) */}
                        {(profile?.location_id === activeTransit.from_location_id) && (canManage || isSecurityRole) && (
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            {activeTransit.status === 'scheduled' && activeTransit.receiver_profile_id && (
                              <Button size="sm" className="text-xs h-7 bg-info text-white hover:bg-info/90" onClick={() => handleTransitAction(activeTransit.id, 'dispatch')}>
                                <Truck className="h-3 w-3 mr-1" /> Dispatch Now
                              </Button>
                            )}
                            {activeTransit.status === 'scheduled' && !activeTransit.receiver_profile_id && (
                              <span className="text-[11px] text-warning font-medium">Assign a receiver before dispatching</span>
                            )}
                            {['scheduled', 'in_transit'].includes(activeTransit.status) && (
                              <Button size="sm" variant="outline" className="text-xs h-7 text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => handleTransitAction(activeTransit.id, 'cancel')}>
                                <XCircle className="h-3 w-3 mr-1" /> Cancel
                              </Button>
                            )}
                          </div>
                        )}
                        {/* Mark Received: assigned receiver */}
                        {activeTransit.status === 'in_transit' && profile?.id === activeTransit.receiver_profile_id && (
                          <div className="pt-1">
                            <Button size="sm" className="w-full text-xs h-7 bg-success text-success-foreground hover:bg-success/90 gap-1.5" onClick={() => { setReceiveTransit(activeTransit); setReceiveNotes(''); }}>
                              <CheckCircle className="h-3 w-3" /> Mark Vehicle Received
                            </Button>
                          </div>
                        )}
                        {/* Admin override: mark received if at destination and not the receiver */}
                        {activeTransit.status === 'in_transit' && canManage && profile?.id !== activeTransit.receiver_profile_id && profile?.location_id === activeTransit.to_location_id && (
                          <div className="pt-1">
                            <Button size="sm" className="text-xs h-7 bg-success text-success-foreground hover:bg-success/90 gap-1.5" onClick={() => handleTransitAction(activeTransit.id, 'arrive')}>
                              <CheckCircle className="h-3 w-3" /> Mark Arrived
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Upcoming drives */}
                    {vehicle.upcoming_drives.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upcoming Drives</p>
                        {vehicle.upcoming_drives.slice(0, 3).map((drive) => {
                          const loc = locations.find(l => l.id === drive.location_id);
                          return (
                            <div key={drive.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2 py-1.5">
                              <CalendarClock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium">{drive.scheduled_date}</span>
                              <span className="text-muted-foreground">{(drive.scheduled_time || '').substring(0, 5)}</span>
                              {loc && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground truncate">{loc.name}</span>
                                </>
                              )}
                              <Badge variant="secondary" className="ml-auto text-[10px] capitalize">{drive.status.replace(/_/g, ' ')}</Badge>
                            </div>
                          );
                        })}
                        {vehicle.upcoming_drives.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">+{vehicle.upcoming_drives.length - 3} more</p>
                        )}
                      </div>
                    )}

                    {/* Action: schedule transit */}
                    {(canManage || isSecurityRole) && !activeTransit && (
                      <div className="pt-2 border-t border-border">
                        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openDispatch(vehicle)}>
                          <PlusCircle className="h-3.5 w-3.5" /> Schedule Transit
                        </Button>
                        {isSecurityRole && (
                          <p className="text-[10px] text-muted-foreground mt-1">Request transit — an admin will dispatch it.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Transit Requests Panel */}
        {profile?.location_id && profile?.id && (
          <div className="mt-2">
            <TransitRequestsPanel
              locationId={profile.location_id}
              profileId={profile.id}
              canManage={canManage}
              dealerId={dealerId || undefined}
              onRequestSent={loadFleet}
            />
          </div>
        )}
      </div>

      {/* ── Dispatch Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={dispatchOpen} onOpenChange={(o) => !o && setDispatchOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> Schedule Vehicle Transit
            </DialogTitle>
            {dispatchVehicle && (
              <DialogDescription>
                {dispatchVehicle.brand} {dispatchVehicle.model}
                {dispatchVehicle.registration_number ? ` · ${dispatchVehicle.registration_number}` : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>From Location</Label>
              <Select value={dispatchFrom} onValueChange={setDispatchFrom}>
                <SelectTrigger><SelectValue placeholder="Select origin" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}{l.city ? `, ${l.city}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label>To Location</Label>
              <Select value={dispatchTo} onValueChange={setDispatchTo}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {locations.filter(l => l.id !== dispatchFrom).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}{l.city ? `, ${l.city}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Departure Time</Label>
              <Input
                type="datetime-local"
                value={dispatchTime}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setDispatchTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={dispatchNotes}
                onChange={e => setDispatchNotes(e.target.value)}
                placeholder="e.g. Driver: Rahul · Contact: 9800XXXXXX"
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDispatchOpen(false)}>Cancel</Button>
              <Button
                onClick={handleDispatch}
                disabled={!dispatchFrom || !dispatchTo || isSending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                Schedule Transit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Assign Receiver Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!assignReceiverTransit} onOpenChange={(o) => !o && setAssignReceiverTransit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Assign Security Receiver
            </DialogTitle>
            <DialogDescription>
              Select the security staff member who will receive the vehicle at the destination.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {securityList.length === 0 ? (
              <p className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                No active security staff found at the destination location.
                Assign one from the Users page first.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Security Staff</Label>
                <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                  <SelectTrigger><SelectValue placeholder="Select receiver" /></SelectTrigger>
                  <SelectContent>
                    {securityList.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}{s.phone ? ` · ${s.phone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAssignReceiverTransit(null)}>Cancel</Button>
              <Button
                onClick={handleAssignReceiver}
                disabled={!selectedReceiver || isAssigning || securityList.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isAssigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                Assign Receiver
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Mark Received Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!receiveTransit} onOpenChange={(o) => !o && setReceiveTransit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" /> Mark Vehicle Received
            </DialogTitle>
            <DialogDescription>
              Confirm you have received the vehicle at your location. Add any notes if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
                placeholder="e.g. All clear, 4 keys, full fuel"
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReceiveTransit(null)}>Cancel</Button>
              <Button
                onClick={handleMarkReceived}
                disabled={isReceiving}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                {isReceiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Confirm Received
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
