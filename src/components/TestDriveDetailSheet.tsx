import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Car, Clock, Phone, Mail, MapPin, User, Shield, Key, CheckCircle2,
  FileCheck, AlertTriangle, Fuel, Route, CheckSquare, CalendarCheck,
} from 'lucide-react';

interface Props {
  testDrive: any | null;
  open: boolean;
  onClose: () => void;
  /** Optional security events for this drive (from securityEventsByDrive map) */
  securityEvents?: {
    checkInBy?: string;
    checkOutBy?: string;
    completedBy?: string;
    logs?: Array<{ label: string; by: string; happenedAt: string; eventType: string }>;
  };
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:              'bg-info/10 text-info border-info/20',
  confirmed:              'bg-primary/10 text-primary border-primary/20',
  show:                   'bg-success/10 text-success border-success/20',
  no_show:                'bg-warning/10 text-warning border-warning/20',
  in_progress:            'bg-accent text-accent-foreground border-accent/30',
  key_handover_to_sales:  'bg-warning/10 text-warning border-warning/20',
  completed:              'bg-success/10 text-success border-success/20',
  cancelled:              'bg-destructive/10 text-destructive border-destructive/20',
  rescheduled:            'bg-muted text-muted-foreground border-border',
};

function fmt(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0 min-w-[110px]">{label}</span>
      <span className="text-foreground text-right break-all">{value || '—'}</span>
    </div>
  );
}

export function TestDriveDetailSheet({ testDrive: td, open, onClose, securityEvents }: Props) {
  if (!td) return null;

  const statusLabel = (td.status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const preKm  = td.pre_drive_km  ?? td.pre_km  ?? null;
  const postKm = td.post_drive_km ?? td.post_km ?? null;
  const distance = preKm != null && postKm != null ? (postKm - preKm).toFixed(1) : null;

  const feedback = td.metadata?.handover_feedback;
  const hasFeedback = feedback && (feedback.questions?.length > 0 || feedback.notes?.trim());

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto p-0"
      >
        {/* ── Header ── */}
        <SheetHeader className="sticky top-0 z-10 bg-background border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-heading text-base">
            <Car className="h-4 w-4 text-primary" />
            Test Drive Details
          </SheetTitle>
          <Badge
            variant="outline"
            className={`w-fit text-xs mt-1 ${STATUS_COLOR[td.status] || ''}`}
          >
            {statusLabel}
          </Badge>
        </SheetHeader>

        <div className="px-5 py-4 space-y-5">

          {/* ── Customer ── */}
          <Section title="Customer" icon={User}>
            <Row label="Name"  value={td.customers?.full_name} />
            <Row label="Phone" value={td.customers?.phone} />
            <Row label="Email" value={td.customers?.email} />
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Licence</span>
              {td.customers?.driving_license_verified ? (
                <Badge className="text-[10px] bg-success/10 text-success border-success/20">
                  <FileCheck className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : td.customers?.driving_license_url ? (
                <Badge variant="outline" className="text-[10px] text-warning">Pending Verification</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-destructive">Not Uploaded</Badge>
              )}
            </div>
          </Section>

          {/* ── Vehicle ── */}
          <Section title="Vehicle" icon={Car}>
            <Row label="Brand"    value={td.vehicles?.brand} />
            <Row label="Model"    value={td.vehicles?.model_name || td.vehicles?.model} />
            <Row label="Variant"  value={td.vehicles?.variant} />
            <Row label="Color"    value={td.vehicles?.color} />
            <Row label="Year"     value={td.vehicles?.year?.toString()} />
          </Section>

          {/* ── Booking Info ── */}
          <Section title="Booking" icon={CalendarCheck}>
            <Row label="Date"      value={td.scheduled_date} />
            <Row label="Time"      value={(td.scheduled_time || '').substring(0, 5) || undefined} />
            <Row label="Location"  value={td.locations?.name} />
            <Row label="Source"    value={td.source} />
            {td.notes && <Row label="Notes" value={td.notes} />}
          </Section>

          {/* ── Assigned Staff ── */}
          <Section title="Assigned Staff" icon={User}>
            <Row label="Sales Person" value={td.profiles?.full_name || td.salesPerson?.full_name} />
            <Row label="GRO"          value={td.gro_profile?.full_name || td.groProfile?.full_name} />
          </Section>

          {/* ── Journey Timeline ── */}
          <Section title="Journey Timeline" icon={Clock}>
            <Row label="Key Handed"    value={fmt(td.key_handed_at)} />
            <Row label="Security In"   value={
              td.security_checked_in_at
                ? `${fmt(td.security_checked_in_at)}${securityEvents?.checkInBy ? ` · ${securityEvents.checkInBy}` : ''}`
                : null
            } />
            <Row label="Drive Started" value={fmt(td.started_at)} />
            <Row label="Security Out"  value={
              td.security_checked_out_at
                ? `${fmt(td.security_checked_out_at)}${securityEvents?.completedBy || securityEvents?.checkOutBy ? ` · ${securityEvents?.completedBy || securityEvents?.checkOutBy}` : ''}`
                : null
            } />
            <Row label="Completed"     value={fmt(td.completed_at)} />
          </Section>

          {/* ── Drive Metrics (if completed) ── */}
          {td.status === 'completed' && (preKm != null || postKm != null) && (
            <Section title="Drive Metrics" icon={Route}>
              <Row label="Pre-Drive KM"    value={preKm?.toString()} />
              <Row label="Post-Drive KM"   value={postKm?.toString()} />
              {distance && <Row label="Distance"       value={`${distance} km`} />}
              <Row label="Pre Fuel Level"  value={td.pre_drive_fuel_level || td.pre_fuel_level} />
              <Row label="Post Fuel Level" value={td.post_drive_fuel_level || td.post_fuel_level} />
            </Section>
          )}

          {/* ── Security Logs ── */}
          {(securityEvents?.logs?.length ?? 0) > 0 && (
            <Section title="Security Logs" icon={Shield}>
              <div className="space-y-1.5">
                {securityEvents!.logs!.map((log, i) => (
                  <div key={i} className="rounded border border-border bg-muted/30 p-2 text-xs">
                    <p className="text-foreground">{log.label}</p>
                    <p className="text-muted-foreground">{log.by} · {fmt(log.happenedAt)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Handover Feedback ── */}
          {hasFeedback && (
            <Section title="Handover Feedback" icon={CheckSquare}>
              {feedback.questions?.length > 0 && (
                <div className="space-y-1">
                  {(feedback.questions as string[]).map((q: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                      <span className="text-foreground">{q}</span>
                    </div>
                  ))}
                </div>
              )}
              {feedback.notes?.trim() && (
                <p className="text-sm text-foreground whitespace-pre-line mt-1">
                  {feedback.notes}
                </p>
              )}
              {feedback.recorded_at && (
                <p className="text-xs text-muted-foreground mt-1">{fmt(feedback.recorded_at)}</p>
              )}
            </Section>
          )}

          {/* ── Licence / Reject Reason ── */}
          {td.license_rejected_reason && (
            <Section title="Licence Rejection" icon={AlertTriangle}>
              <p className="text-sm text-destructive">{td.license_rejected_reason}</p>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
