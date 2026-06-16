import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Truck, Navigation, Clock, Car, MapPin, User,
  CheckCircle, ArrowRight, Loader2, Bell,
} from 'lucide-react';

interface IncomingTransit {
  id: string;
  status: 'scheduled' | 'in_transit';
  vehicle: { id: string; brand: string; model: string; variant?: string; color?: string; registration_number?: string } | null;
  from_location: { name: string; city?: string } | null;
  receiver: { id: string; full_name: string; phone?: string } | null;
  receiver_profile_id: string | null;
  distance_km: number | null;
  transit_minutes: number | null;
  eta_time: string;
  depart_time: string;
  trigger: string;
  notes?: string | null;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return `Today ${fmtTime(iso)}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${fmtTime(iso)}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(iso);
};

const fmtMinutes = (m: number | null) => {
  if (m === null) return '—';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

interface IncomingVehiclesPanelProps {
  locationId: string;
  /** Current logged-in profile id (for marking received) */
  profileId: string;
  /** When true, hides action buttons — read-only view for non-security roles */
  readOnly?: boolean;
}

export default function IncomingVehiclesPanel({ locationId, profileId, readOnly = false }: IncomingVehiclesPanelProps) {
  const { toast } = useToast();
  const [transits, setTransits] = useState<IncomingTransit[]>([]);
  const [loading, setLoading] = useState(true);

  // Receive confirmation dialog
  const [receiveTransit, setReceiveTransit] = useState<IncomingTransit | null>(null);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<IncomingTransit[]>(`/api/fleet/locations/${locationId}/incoming`);
      setTransits(data || []);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const handleReceive = async () => {
    if (!receiveTransit) return;
    setIsReceiving(true);
    try {
      await apiPatch(`/api/fleet/transits/${encodeURIComponent(receiveTransit.id)}/receive`, {
        profile_id: profileId,
        notes: receiveNotes || null,
      });
      toast({
        title: 'Vehicle received',
        description: `${receiveTransit.vehicle?.brand} ${receiveTransit.vehicle?.model} has been marked as received at your location.`,
      });
      setReceiveTransit(null);
      setReceiveNotes('');
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message || 'Could not mark vehicle as received.', variant: 'destructive' });
    } finally {
      setIsReceiving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading incoming vehicles…
      </div>
    );
  }

  if (transits.length === 0) {
    return (
      <div className="flex items-center gap-3 py-6 text-muted-foreground text-sm">
        <Truck className="h-5 w-5 shrink-0" />
        No vehicles currently in transit to your location.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {transits.map((transit) => {
          const isAssignedToMe = transit.receiver_profile_id === profileId;
          const isInTransit = transit.status === 'in_transit';

          return (
            <Card
              key={transit.id}
              className={`border ${isInTransit ? 'border-info/40 bg-info/5' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/10'} shadow-sm`}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isInTransit ? 'bg-info/15' : 'bg-amber-100'}`}>
                      <Truck className={`h-4.5 w-4.5 ${isInTransit ? 'text-info' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {transit.vehicle?.brand} {transit.vehicle?.model}
                        {transit.vehicle?.variant && <span className="font-normal text-muted-foreground"> {transit.vehicle.variant}</span>}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {transit.vehicle?.color && <span className="text-xs text-muted-foreground">{transit.vehicle.color}</span>}
                        {transit.vehicle?.registration_number && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{transit.vehicle.registration_number}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${isInTransit ? 'bg-info/15 text-info border-info/30' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                    {isInTransit ? 'In Transit' : 'Scheduled'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-3 space-y-2.5 pt-0">
                {/* Route info */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{transit.from_location?.name ?? '—'}</span>
                  {transit.from_location?.city && <span className="text-muted-foreground/60">({transit.from_location.city})</span>}
                  <ArrowRight className="h-3 w-3 shrink-0 text-primary mx-0.5" />
                  <span className="font-medium text-foreground">Your Location</span>
                </div>

                {/* ETA + distance */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Clock className="h-3 w-3 text-primary" />
                    ETA: {fmtDate(transit.eta_time)}
                  </span>
                  {transit.distance_km != null && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Navigation className="h-3 w-3" /> {transit.distance_km} km
                    </span>
                  )}
                  {transit.transit_minutes != null && (
                    <span className="text-muted-foreground">~{fmtMinutes(transit.transit_minutes)} drive</span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1 capitalize">{transit.trigger}</Badge>
                </div>

                {/* Receiver assignment */}
                <div className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${isAssignedToMe ? 'bg-primary/10 border border-primary/20' : 'bg-muted/40 border border-border'}`}>
                  <User className={`h-3 w-3 shrink-0 ${isAssignedToMe ? 'text-primary' : 'text-muted-foreground'}`} />
                  {transit.receiver ? (
                    <span className={isAssignedToMe ? 'text-primary font-medium' : 'text-muted-foreground'}>
                      Receiver: {transit.receiver.full_name}
                      {isAssignedToMe && ' (You)'}
                      {transit.receiver.phone && ` · ${transit.receiver.phone}`}
                    </span>
                  ) : (
                    <span className="text-warning font-medium">No receiver assigned yet</span>
                  )}
                </div>

                {/* Notes */}
                {transit.notes && (
                  <p className="text-xs text-muted-foreground italic">{transit.notes}</p>
                )}

                {/* Action — only the assigned receiver sees this button */}
                {isInTransit && isAssignedToMe && !readOnly && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      className="w-full bg-success text-success-foreground hover:bg-success/90 gap-2"
                      onClick={() => { setReceiveTransit(transit); setReceiveNotes(''); }}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark Vehicle Received
                    </Button>
                  </div>
                )}
                {isInTransit && !isAssignedToMe && !readOnly && transit.receiver_profile_id && (
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Only the assigned receiver can mark this vehicle as received.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Receive confirmation dialog ─────────────────────────────────────── */}
      <Dialog open={!!receiveTransit} onOpenChange={(o) => !o && setReceiveTransit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" /> Confirm Vehicle Receipt
            </DialogTitle>
            {receiveTransit && (
              <DialogDescription>
                {receiveTransit.vehicle?.brand} {receiveTransit.vehicle?.model}
                {receiveTransit.vehicle?.registration_number ? ` · ${receiveTransit.vehicle.registration_number}` : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {receiveTransit && (
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm space-y-1.5">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  From: <span className="font-medium text-foreground">{receiveTransit.from_location?.name}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  ETA was: <span className="font-medium text-foreground">{fmtDate(receiveTransit.eta_time)}</span>
                </p>
                {receiveTransit.distance_km && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Navigation className="h-3.5 w-3.5 shrink-0" />
                    Distance: <span className="font-medium text-foreground">{receiveTransit.distance_km} km</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Handover Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
                placeholder="e.g. Vehicle condition OK · Fuel level 3/4 · Keys handed over"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReceiveTransit(null)}>Cancel</Button>
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={handleReceive}
                disabled={isReceiving}
              >
                {isReceiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Confirm Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
