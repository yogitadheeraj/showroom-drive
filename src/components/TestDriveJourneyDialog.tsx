import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sendTransactionalEmail } from '@/lib/functionService';
import {
  Mail, Car, ShieldCheck, KeyRound, ClipboardCheck,
  CheckCircle2, AlertCircle, MessageSquare, Star, Building2,
  Send, Loader2, Clock3, ExternalLink
} from 'lucide-react';

interface TestDrive {
  id: string;
  status: string;
  metadata?: Record<string, any> | null;
  started_at?: string | null;
  completed_at?: string | null;
  security_checked_in_at?: string | null;
  security_checked_out_at?: string | null;
  scheduled_date?: string;
  scheduled_time?: string;
  customers?: { full_name?: string; email?: string; phone?: string };
  vehicles?: { brand?: string; model?: string; year?: number };
  locations?: { name?: string; address?: string; phone?: string };
  profiles?: { full_name?: string };
}

interface Props {
  testDrive: TestDrive | null;
  open: boolean;
  onClose: () => void;
}

const JOURNEY_STEPS = [
  {
    id: 1,
    icon: '📧',
    emoji: Mail,
    title: 'Booking Confirmation',
    subtitle: 'Email & WhatsApp notification sent',
    description: 'You will receive a confirmation via email and WhatsApp with your appointment details, vehicle info, and location map.',
    color: 'blue',
    statuses: ['scheduled', 'confirmed', 'show', 'in_progress', 'completed'],
  },
  {
    id: 2,
    icon: '🪪',
    emoji: AlertCircle,
    title: 'Upload Driving License',
    subtitle: 'Submit your valid license',
    description: 'Upload a clear photo/scan of your valid driving license before your visit. This is required to proceed with the test drive.',
    color: 'violet',
    statuses: ['confirmed', 'show', 'in_progress', 'completed'],
  },
  {
    id: 3,
    icon: '🔍',
    emoji: ShieldCheck,
    title: 'License Verification',
    subtitle: 'Security team validates your license',
    description: 'Our security team will verify the authenticity and validity of your driving license when you arrive at the showroom.',
    color: 'indigo',
    statuses: ['show', 'in_progress', 'completed'],
  },
  {
    id: 4,
    icon: '🔑',
    emoji: KeyRound,
    title: 'Key Handover',
    subtitle: 'Sales executive hands you the keys',
    description: 'Your assigned sales executive will greet you, introduce the vehicle features, and hand over the keys for your test drive.',
    color: 'amber',
    statuses: ['in_progress', 'completed'],
  },
  {
    id: 5,
    icon: '🚗',
    emoji: ClipboardCheck,
    title: 'Pre-Drive Inspection',
    subtitle: 'Security checks vehicle condition',
    description: 'Security performs a thorough pre-drive inspection — noting any existing dents, scratches, fuel level, and odometer reading.',
    color: 'orange',
    statuses: ['in_progress', 'completed'],
  },
  {
    id: 6,
    icon: '🏁',
    emoji: Car,
    title: 'Test Drive',
    subtitle: 'Enjoy the drive!',
    description: 'Take the car for a spin on the designated test drive route. Experience the performance, comfort, and features first-hand.',
    color: 'green',
    statuses: ['in_progress', 'completed'],
  },
  {
    id: 7,
    icon: '🧾',
    emoji: ClipboardCheck,
    title: 'Post-Drive Inspection',
    subtitle: 'Final check & status update',
    description: 'Security team does a post-drive inspection, compares with pre-drive notes, and marks all formalities as complete.',
    color: 'teal',
    statuses: ['completed'],
  },
  {
    id: 8,
    icon: '✅',
    emoji: CheckCircle2,
    title: 'Journey Complete',
    subtitle: 'Return keys & wrap-up with sales',
    description: 'Return the keys to your assigned sales person. They will complete your test drive record and answer any questions about purchase, financing, or next steps.',
    color: 'emerald',
    statuses: ['completed'],
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  green:   { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-700',   dot: 'bg-green-500' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

function getStepState(step: typeof JOURNEY_STEPS[0], currentStatus: string): 'completed' | 'active' | 'upcoming' {
  const statusOrder = ['scheduled', 'confirmed', 'show', 'in_progress', 'completed'];
  const currentIdx = statusOrder.indexOf(currentStatus);

  // completed status: all steps done
  if (currentStatus === 'completed') return 'completed';

  const stateMap: Record<string, number> = {
    scheduled: 1,
    confirmed: 2,
    show: 3,
    in_progress: 6,
    completed: 8,
  };
  const activeStep = stateMap[currentStatus] ?? 1;

  if (step.id < activeStep) return 'completed';
  if (step.id === activeStep) return 'active';
  return 'upcoming';
}

function getDurationMinutes(testDrive: TestDrive): number | null {
  const start = testDrive.security_checked_in_at || testDrive.started_at;
  const end = testDrive.security_checked_out_at || testDrive.completed_at;
  if (!start || !end) return null;

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
}

export function TestDriveJourneyDialog({ testDrive, open, onClose }: Props) {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  if (!testDrive) return null;

  const currentStatus = testDrive.status;
  const customerEmail = testDrive.customers?.email;
  const enquiryId = (testDrive.metadata as any)?.enquiry_id || '';
  const durationMinutes = getDurationMinutes(testDrive);
  const feedbackUrl = `${window.location.origin}/test-drive-feedback?td=${encodeURIComponent(testDrive.id)}${enquiryId ? `&enquiry_id=${encodeURIComponent(enquiryId)}` : ''}`;

  const handleSendEmail = async () => {
    if (!customerEmail) {
      toast({ title: 'No email found', description: 'This customer does not have an email address on record.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      await sendTransactionalEmail({
          templateName: 'test-drive-journey',
          recipientEmail: customerEmail,
          templateData: {
            customerName: testDrive.customers?.full_name,
            vehicleName: `${testDrive.vehicles?.brand || ''} ${testDrive.vehicles?.model || ''}`.trim(),
            locationName: testDrive.locations?.name,
            locationAddress: testDrive.locations?.address,
            locationPhone: testDrive.locations?.phone,
            scheduledDate: testDrive.scheduled_date,
            scheduledTime: testDrive.scheduled_time,
            salesPersonName: testDrive.profiles?.full_name,
            currentStatus,
            feedbackLink: feedbackUrl,
            enquiryId,
            totalDurationMinutes: durationMinutes,
          },
      });

      toast({ title: 'Journey email sent!', description: `Full journey steps sent to ${customerEmail}` });
    } catch (err: any) {
      toast({ title: 'Failed to send email', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const stepStates = JOURNEY_STEPS.map(step => ({
    ...step,
    state: getStepState(step, currentStatus),
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0e2340] to-[#123b6e] text-white px-6 pt-6 pb-4 rounded-t-xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-white text-xl font-bold">
                  Test Drive Journey
                </DialogTitle>
                <p className="text-blue-200 text-sm mt-1">
                  {testDrive.customers?.full_name} · {testDrive.vehicles?.brand} {testDrive.vehicles?.model}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 capitalize bg-white/20 text-white border-white/30 text-xs"
              >
                {currentStatus.replace('_', ' ')}
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-blue-200">
              {testDrive.scheduled_date && (
                <span>📅 {testDrive.scheduled_date} {testDrive.scheduled_time && `at ${testDrive.scheduled_time}`}</span>
              )}
              {testDrive.locations?.name && <span>📍 {testDrive.locations.name}</span>}
              {testDrive.profiles?.full_name && <span>👤 {testDrive.profiles.full_name}</span>}
              {durationMinutes !== null && <span>⏱ {durationMinutes} mins in showroom</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {durationMinutes !== null && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/40 text-xs">
                  <Clock3 className="h-3 w-3 mr-1" /> Completion Time: {durationMinutes} mins
                </Badge>
              )}
              {enquiryId && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/40 text-xs">
                  Enquiry ID: {enquiryId}
                </Badge>
              )}
            </div>

            {/* Send email CTA */}
            {customerEmail && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="bg-white text-[#0e2340] hover:bg-blue-50 font-semibold text-xs gap-1.5"
                >
                  {sending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="h-3.5 w-3.5" /> Send Journey to Customer</>
                  )}
                </Button>
                <Button
                  size="sm"
                  asChild
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10 font-semibold text-xs gap-1.5"
                >
                  <a href={feedbackUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Feedback Link
                  </a>
                </Button>
              </div>
            )}
          </DialogHeader>
        </div>

        {/* Journey Steps */}
        <div className="px-6 py-5 space-y-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            Complete Journey — {stepStates.filter(s => s.state === 'completed').length} of {JOURNEY_STEPS.length} steps done
          </p>

          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-border" />

            <div className="space-y-3">
              {stepStates.map((step, idx) => {
                const colors = COLOR_MAP[step.color];
                const isDone = step.state === 'completed';
                const isActive = step.state === 'active';
                const isUpcoming = step.state === 'upcoming';

                return (
                  <div
                    key={step.id}
                    className={`relative flex gap-4 rounded-xl border p-4 transition-all ${
                      isDone
                        ? 'bg-muted/30 border-border/40 opacity-70'
                        : isActive
                        ? `${colors.bg} ${colors.border} shadow-sm`
                        : 'bg-background border-border/30 opacity-50'
                    }`}
                  >
                    {/* Step number / status dot */}
                    <div className="shrink-0 relative z-10">
                      <div
                        className={`h-11 w-11 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
                          isDone
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-600'
                            : isActive
                            ? `${colors.bg} ${colors.border} ${colors.text}`
                            : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {isDone ? '✓' : step.icon}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isDone ? 'text-muted-foreground line-through' : isActive ? colors.text : 'text-muted-foreground'}`}>
                          {step.title}
                        </span>
                        {isActive && (
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${colors.bg} ${colors.border} ${colors.text}`}>
                            Current
                          </Badge>
                        )}
                        {isDone && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-50 border-emerald-200 text-emerald-600">
                            Done
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">{step.subtitle}</p>
                      {(isActive || isDone) && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step.description}</p>
                      )}
                    </div>

                    {/* Step number pill */}
                    <div className="shrink-0 self-start">
                      <span className="text-[10px] font-bold text-muted-foreground/50">0{step.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Showroom & Purchase Footer */}
        <div className="mx-6 mb-6 rounded-xl border border-border bg-gradient-to-br from-muted/50 to-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">
                {testDrive.locations?.name || 'Visit Our Showroom'}
              </p>
              {testDrive.locations?.address && (
                <p className="text-xs text-muted-foreground mt-0.5">{testDrive.locations.address}</p>
              )}
              {testDrive.locations?.phone && (
                <p className="text-xs text-muted-foreground">{testDrive.locations.phone}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2.5">
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask sales team any questions
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Star className="h-3.5 w-3.5" />
                  Explore purchase &amp; finance options
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
