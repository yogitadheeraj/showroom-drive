/**
 * TransitRequestsPanel
 * ────────────────────
 * Dual-view panel for the shared vehicle fleet system:
 *
 *  "Incoming Requests" tab  — shown to MANAGERS at the source branch
 *    Requests for vehicles at THEIR location to be sent elsewhere.
 *    They can approve (with optional note) or reject (with required reason).
 *
 *  "My Requests" tab — shown to all staff who submitted requests
 *    Their own outbound requests with current status + manager feedback.
 *    Pending requests can be cancelled.
 *
 * Props:
 *   locationId      — current user's location
 *   profileId       — current user's profile ID
 *   canManage       — true for DEALER_ADMIN / SALES_ADMIN (can approve/reject)
 *   dealerId?       — scope to dealer for multi-dealer setups
 *   onRequestSent?  — called after a new request is submitted (parent can refresh)
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Clock, Truck, MapPin, Navigation, Calendar, RefreshCw, Send, ChevronDown, ChevronUp, Info } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────

interface TransitRequest {
  id: string;
  vehicle_id: string;
  from_location_id: string;
  to_location_id: string;
  requested_by_profile_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requester_notes: string | null;
  manager_notes: string | null;
  actioned_by_profile_id: string | null;
  actioned_at: string | null;
  requested_at: string;
  needed_for_date: string | null;
  scheduled_transit_id: string | null;
  vehicle?: { brand: string; model: string; variant?: string; registration_number?: string } | null;
  from_location?: { name: string; city?: string } | null;
  to_location?: { name: string; city?: string } | null;
  requester?: { full_name: string; email?: string; phone?: string } | null;
  actioner?: { full_name: string } | null;
}

interface Props {
  locationId: string;
  profileId: string;
  canManage: boolean;
  dealerId?: string;
  onRequestSent?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'bg-warning/10 text-warning border-warning/30',   icon: <Clock className="h-3 w-3" /> },
  approved:  { label: 'Approved',  color: 'bg-success/10 text-success border-success/30',   icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { label: 'Rejected',  color: 'bg-destructive/10 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground border-border',   icon: <XCircle className="h-3 w-3" /> },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}
function locLabel(loc?: { name: string; city?: string } | null) {
  if (!loc) return '—';
  return loc.city ? `${loc.name}, ${loc.city}` : loc.name;
}
function vehicleLabel(v?: { brand: string; model: string; variant?: string; registration_number?: string } | null) {
  if (!v) return '—';
  return `${v.brand} ${v.model}${v.variant ? ` ${v.variant}` : ''}${v.registration_number ? ` · ${v.registration_number}` : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TransitRequestsPanel({ locationId, profileId, canManage, dealerId, onRequestSent }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'inbound' | 'outbound'>(canManage ? 'inbound' : 'outbound');

  // ── Data ──
  const [inbound, setInbound] = useState<TransitRequest[]>([]);
  const [outbound, setOutbound] = useState<TransitRequest[]>([]);
  const [loadingInbound, setLoadingInbound] = useState(false);
  const [loadingOutbound, setLoadingOutbound] = useState(false);

  // ── Action dialogs ──
  const [actioning, setActioning] = useState<TransitRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  // ── New request dialog ──
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [sharedVehicles, setSharedVehicles] = useState<any[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [newReqVehicle, setNewReqVehicle] = useState('');
  const [newReqFromLoc, setNewReqFromLoc] = useState('');
  const [newReqDate, setNewReqDate] = useState('');
  const [newReqNotes, setNewReqNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Expanded cards ──
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch
  // ─────────────────────────────────────────────────────────────────────────

  const loadInbound = useCallback(async () => {
    if (!locationId) return;
    setLoadingInbound(true);
    try {
      const params = new URLSearchParams({ from_location_id: locationId });
      if (dealerId) params.set('dealer_id', dealerId);
      const data = await apiGet<TransitRequest[]>(`/api/fleet/transit-requests?${params}`);
      setInbound(data || []);
    } finally {
      setLoadingInbound(false);
    }
  }, [locationId, dealerId]);

  const loadOutbound = useCallback(async () => {
    if (!profileId) return;
    setLoadingOutbound(true);
    try {
      const params = new URLSearchParams({ requested_by_profile_id: profileId });
      if (dealerId) params.set('dealer_id', dealerId);
      const data = await apiGet<TransitRequest[]>(`/api/fleet/transit-requests?${params}`);
      setOutbound(data || []);
    } finally {
      setLoadingOutbound(false);
    }
  }, [profileId, dealerId]);

  useEffect(() => { void loadInbound(); }, [loadInbound]);
  useEffect(() => { void loadOutbound(); }, [loadOutbound]);

  // Load available shared vehicles for new-request dialog
  // Uses /api/vehicles/available which:
  //   - respects shared_location_ids per vehicle
  //   - excludes vehicles already at this location (is_local)
  //   - excludes vehicles with slot conflicts on chosen date
  useEffect(() => {
    if (!newRequestOpen || !locationId) return;
    setLoadingVehicles(true);
    const today = new Date().toISOString().split('T')[0];
    const date = newReqDate || today;
    apiGet<{ local: any[]; shared: any[] }>(
      `/api/vehicles/available?location_id=${encodeURIComponent(locationId)}&date=${date}`,
    )
      .then((res) => {
        // Only show shared vehicles NOT already at this location
        const available = (res?.shared || []).filter((v: any) => !v.is_local);
        setSharedVehicles(available);
        // Clear selection if the currently selected vehicle is no longer in the list
        if (newReqVehicle && !available.find((v: any) => v.id === newReqVehicle)) {
          setNewReqVehicle('');
          setNewReqFromLoc('');
        }
      })
      .catch(() => setSharedVehicles([]))
      .finally(() => setLoadingVehicles(false));
  }, [newRequestOpen, locationId, newReqDate]);

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  async function handleAction() {
    if (!actioning || !actionType) return;
    if (actionType === 'reject' && !actionNotes.trim()) {
      toast({ title: 'Reason required', description: 'Please enter a rejection reason', variant: 'destructive' });
      return;
    }
    setIsActioning(true);
    try {
      const endpoint = `/api/fleet/transit-requests/${actioning.id}/${actionType}`;
      const body = actionType === 'approve'
        ? { manager_profile_id: profileId, notes: actionNotes || null }
        : { manager_profile_id: profileId, notes: actionNotes };
      await apiPatch(endpoint, body);
      toast({
        title: actionType === 'approve' ? 'Request approved' : 'Request rejected',
        description: actionType === 'approve'
          ? 'Transit has been scheduled. All parties notified.'
          : 'Requester has been notified with your reason.',
      });
      setActioning(null);
      setActionType(null);
      setActionNotes('');
      await Promise.all([loadInbound(), loadOutbound()]);
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsActioning(false);
    }
  }

  async function handleCancel(req: TransitRequest) {
    try {
      await apiPatch(`/api/fleet/transit-requests/${req.id}/cancel`, { requester_profile_id: profileId });
      toast({ title: 'Request cancelled' });
      await loadOutbound();
    } catch (err: any) {
      toast({ title: 'Cancel failed', description: err.message, variant: 'destructive' });
    }
  }

  async function handleNewRequest() {
    if (!newReqVehicle || !newReqFromLoc) {
      toast({ title: 'Missing fields', description: 'Please select a vehicle and source location', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiPost('/api/fleet/transit-requests', {
        vehicle_id: newReqVehicle,
        from_location_id: newReqFromLoc,
        to_location_id: locationId,
        requested_by_profile_id: profileId,
        needed_for_date: newReqDate || null,
        notes: newReqNotes || null,
        dealer_id: dealerId || null,
      } as Record<string, unknown>);
      toast({
        title: 'Request submitted!',
        description: 'The source branch manager has been notified and will respond shortly.',
      });
      setNewRequestOpen(false);
      setNewReqVehicle('');
      setNewReqFromLoc('');
      setNewReqDate('');
      setNewReqNotes('');
      setSharedVehicles([]);
      await loadOutbound();
      onRequestSent?.();
    } catch (err: any) {
      toast({ title: 'Submit failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const pendingInbound = inbound.filter((r) => r.status === 'pending').length;
  const pendingOutbound = outbound.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">Vehicle Transit Requests</h3>
          {pendingInbound > 0 && canManage && (
            <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">
              {pendingInbound} pending approval
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setNewRequestOpen(true)} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          Request a Vehicle
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-full">
        {canManage && (
          <button
            onClick={() => setTab('inbound')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-1.5 px-3 rounded-md transition-all ${
              tab === 'inbound' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Inbound Requests
            {pendingInbound > 0 && (
              <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-warning text-white text-[9px] font-bold px-1">
                {pendingInbound}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setTab('outbound')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-1.5 px-3 rounded-md transition-all ${
            tab === 'outbound' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Requests
          {pendingOutbound > 0 && (
            <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-info text-white text-[9px] font-bold px-1">
              {pendingOutbound}
            </span>
          )}
        </button>
      </div>

      {/* ── Inbound (pending approval) ── */}
      {tab === 'inbound' && canManage && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Requests for vehicles at your branch</p>
            <button onClick={loadInbound} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingInbound ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingInbound ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : inbound.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Truck className="h-8 w-8 opacity-30" />
              <p className="text-sm">No transit requests for your branch</p>
            </div>
          ) : (
            inbound.map((req) => {
              const cfg = STATUS_CONFIG[req.status];
              const isExpanded = expanded.has(req.id);
              return (
                <div key={req.id} className={`rounded-xl border transition-all ${
                  req.status === 'pending' ? 'border-warning/30 bg-warning/3' : 'border-border bg-muted/20'
                }`}>
                  {/* Card header */}
                  <div
                    className="flex items-start justify-between gap-3 p-3 cursor-pointer"
                    onClick={() => setExpanded((prev) => {
                      const n = new Set(prev);
                      n.has(req.id) ? n.delete(req.id) : n.add(req.id);
                      return n;
                    })}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-sm truncate">{vehicleLabel(req.vehicle)}</p>
                        <Badge className={`text-[9px] border gap-1 shrink-0 ${cfg.color}`}>
                          {cfg.icon}{cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{locLabel(req.to_location)}</span>
                        <span>·</span>
                        <span>{req.requester?.full_name || '—'}</span>
                        <span>·</span>
                        <span>{fmtDate(req.requested_at)}</span>
                        {req.needed_for_date && (
                          <><span>·</span><span className="flex items-center gap-1 text-info"><Calendar className="h-3 w-3" />Needed: {req.needed_for_date}</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] border-success/40 text-success hover:bg-success/10 px-2"
                            onClick={(e) => { e.stopPropagation(); setActioning(req); setActionType('approve'); setActionNotes(''); }}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/10 px-2"
                            onClick={(e) => { e.stopPropagation(); setActioning(req); setActionType('reject'); setActionNotes(''); }}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-2 text-sm">
                      {req.requester_notes && (
                        <div className="flex items-start gap-2 bg-muted/40 rounded-md p-2 text-[12px]">
                          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-muted-foreground"><strong>Note from requester:</strong> {req.requester_notes}</span>
                        </div>
                      )}
                      {req.manager_notes && (
                        <div className={`flex items-start gap-2 rounded-md p-2 text-[12px] ${req.status === 'rejected' ? 'bg-destructive/8' : 'bg-success/8'}`}>
                          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span><strong>Manager note:</strong> {req.manager_notes}</span>
                        </div>
                      )}
                      {req.actioned_at && (
                        <p className="text-[11px] text-muted-foreground">
                          {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.actioner?.full_name || '—'} on {fmtDate(req.actioned_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Outbound (my requests) ── */}
      {tab === 'outbound' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Requests you have submitted</p>
            <button onClick={loadOutbound} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingOutbound ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingOutbound ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : outbound.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Send className="h-8 w-8 opacity-30" />
              <p className="text-sm">No requests submitted yet</p>
              <Button size="sm" variant="outline" onClick={() => setNewRequestOpen(true)} className="mt-1 gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Request a Vehicle
              </Button>
            </div>
          ) : (
            outbound.map((req) => {
              const cfg = STATUS_CONFIG[req.status];
              const isExpanded = expanded.has(req.id);
              return (
                <div key={req.id} className={`rounded-xl border transition-all ${
                  req.status === 'pending' ? 'border-info/30 bg-info/3'
                  : req.status === 'approved' ? 'border-success/30 bg-success/3'
                  : req.status === 'rejected' ? 'border-destructive/20 bg-destructive/3'
                  : 'border-border bg-muted/20'
                }`}>
                  <div
                    className="flex items-start justify-between gap-3 p-3 cursor-pointer"
                    onClick={() => setExpanded((prev) => {
                      const n = new Set(prev);
                      n.has(req.id) ? n.delete(req.id) : n.add(req.id);
                      return n;
                    })}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-sm truncate">{vehicleLabel(req.vehicle)}</p>
                        <Badge className={`text-[9px] border gap-1 shrink-0 ${cfg.color}`}>
                          {cfg.icon}{cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {locLabel(req.from_location)} → {locLabel(req.to_location)}
                        </span>
                        <span>·</span>
                        <span>{fmtDate(req.requested_at)}</span>
                        {req.needed_for_date && (
                          <><span>·</span><span className="flex items-center gap-1 text-info"><Calendar className="h-3 w-3" />Needed: {req.needed_for_date}</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px] text-muted-foreground px-2"
                          onClick={(e) => { e.stopPropagation(); handleCancel(req); }}>
                          Cancel
                        </Button>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-2 text-sm">
                      {req.requester_notes && (
                        <div className="text-[12px] text-muted-foreground bg-muted/40 rounded-md p-2">
                          <strong>Your note:</strong> {req.requester_notes}
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <div className="flex items-center gap-1.5 text-[12px] text-success bg-success/8 rounded-md p-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Approved by {req.actioner?.full_name || '—'} on {req.actioned_at ? fmtDate(req.actioned_at) : '—'}
                          {req.manager_notes && <span> — "{req.manager_notes}"</span>}
                        </div>
                      )}
                      {req.status === 'rejected' && (
                        <div className="flex items-start gap-1.5 text-[12px] text-destructive bg-destructive/8 rounded-md p-2">
                          <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>Rejected by {req.actioner?.full_name || '—'}
                            {req.manager_notes && <> — <em>"{req.manager_notes}"</em></>}
                          </span>
                        </div>
                      )}
                      {req.scheduled_transit_id && (
                        <p className="text-[11px] text-muted-foreground">Transit ID: {req.scheduled_transit_id.slice(-8)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Approve / Reject dialog ── */}
      <Dialog open={!!actioning && !!actionType} onOpenChange={() => { setActioning(null); setActionType(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve'
                ? <><CheckCircle2 className="h-5 w-5 text-success" /> Approve Transit Request</>
                : <><XCircle className="h-5 w-5 text-destructive" /> Reject Transit Request</>}
            </DialogTitle>
          </DialogHeader>
          {actioning && (
            <div className="space-y-4">
              {/* Request summary */}
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-20">Vehicle</span>
                  <span className="font-medium">{vehicleLabel(actioning.vehicle)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-20">Requested by</span>
                  <span>{actioning.requester?.full_name || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-20">Destination</span>
                  <span>{locLabel(actioning.to_location)}</span>
                </div>
                {actioning.needed_for_date && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-20">Needed for</span>
                    <span>{actioning.needed_for_date}</span>
                  </div>
                )}
                {actioning.requester_notes && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground text-xs w-20 mt-0.5">Note</span>
                    <span className="text-sm italic">{actioning.requester_notes}</span>
                  </div>
                )}
              </div>

              {/* Notes / Reason */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {actionType === 'approve' ? 'Comments (optional)' : 'Rejection reason *'}
                </label>
                <Textarea
                  rows={3}
                  placeholder={actionType === 'approve'
                    ? 'Add any notes for the requester or security team…'
                    : 'Explain why this request cannot be fulfilled…'}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="resize-none text-sm"
                />
              </div>

              {actionType === 'approve' && (
                <div className="flex items-start gap-2 p-2.5 bg-info/8 border border-info/20 rounded-lg text-[12px] text-info">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Approving will immediately schedule a transit and notify the requester, destination security, and source security via email.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setActioning(null); setActionType(null); }} disabled={isActioning}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={isActioning || (actionType === 'reject' && !actionNotes.trim())}
                  className={actionType === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}
                >
                  {isActioning
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
                    : actionType === 'approve' ? 'Approve & Schedule Transit' : 'Reject Request'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── New Request dialog ── */}
      <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-info" /> Request a Shared Vehicle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select an available shared vehicle from another branch. Only vehicles accessible to your location and not already here are shown.
            </p>

            {/* Date first — drives the vehicle availability list */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Needed For (date)</label>
              <input
                type="date"
                value={newReqDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setNewReqDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Vehicle picker — card-based, not Select */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Available Shared Vehicle *</label>
              {loadingVehicles ? (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
                </div>
              ) : sharedVehicles.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-6 rounded-lg border border-dashed border-border bg-muted/30 text-center">
                  <Truck className="h-7 w-7 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">No shared vehicles available for your location</p>
                  <p className="text-[11px] text-muted-foreground/70">Vehicles may be at your branch already, in transit, or not shared with your location</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {sharedVehicles.map((v: any) => {
                    const isSelected = newReqVehicle === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setNewReqVehicle(v.id);
                          setNewReqFromLoc(v.current_location_id || v.location_id || '');
                        }}
                        className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-info bg-info/8 ring-1 ring-info'
                            : 'border-border hover:border-info/40 hover:bg-info/4'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{v.brand} {v.model}{v.variant ? ` ${v.variant}` : ''}</p>
                            {v.registration_number && (
                              <span className="text-[10px] text-muted-foreground border border-border rounded px-1">{v.registration_number}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {v.current_location_name && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{v.current_location_name}
                              </span>
                            )}
                            {v.transit_minutes != null && (
                              <span className="text-[11px] text-info font-medium flex items-center gap-1">
                                <Navigation className="h-3 w-3" />
                                ~{v.transit_minutes >= 60
                                  ? `${Math.floor(v.transit_minutes / 60)}h ${v.transit_minutes % 60}m`
                                  : `${v.transit_minutes}m`} transit
                              </span>
                            )}
                            {v.distance_km != null && (
                              <span className="text-[11px] text-muted-foreground">{v.distance_km} km</span>
                            )}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-info shrink-0 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                rows={2}
                placeholder="Reason for request, customer details, urgency…"
                value={newReqNotes}
                onChange={(e) => setNewReqNotes(e.target.value)}
                className="resize-none text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNewRequestOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleNewRequest} disabled={isSubmitting || !newReqVehicle || !newReqFromLoc}>
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
                  : <><Send className="h-4 w-4 mr-2" /> Submit Request</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
