import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import RouteCalculator from '@/components/RouteCalculator';
import {
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  PlusCircle,
  Upload,
  X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type BookingData = {
  test_drive: {
    id: string;
    status: string;
    scheduled_date: string;
    scheduled_time: string;
    slot_duration_minutes: number;
    cancelled_reason?: string;
  };
  customer: {
    full_name: string;
    email: string;
    phone: string;
    driving_license_url?: string;
    driving_license_verified?: boolean;
  } | null;
  vehicle: {
    brand: string;
    model: string;
    variant?: string;
  } | null;
  location: {
    name: string;
    city: string;
    address?: string;
    latitude?: string | null;
    longitude?: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
  confirmed:   { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  rescheduled: { label: 'Rescheduled', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  cancelled:   { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  completed:   { label: 'Completed', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  show:        { label: 'Show', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' },
  in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' },
  no_show:     { label: 'No Show', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
};

type View = 'details' | 'reschedule' | 'upload' | 'cancel' | 'rebook';

export default function CustomerBookingPage() {
  const { testDriveId } = useParams<{ testDriveId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('details');

  // Reschedule form
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Cancel
  const [isCancelling, setIsCancelling] = useState(false);
  const CANCEL_REASONS = [
    'Change of plans',
    'Found a different vehicle',
    'Scheduling conflict',
    'No longer interested',
    'Other',
  ] as const;
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelNote, setCancelNote] = useState('');

  // Rebook
  const [rebookDate, setRebookDate] = useState('');
  const [rebookTime, setRebookTime] = useState('');
  const [isRebooking, setIsRebooking] = useState(false);
  const [rebookSuccess, setRebookSuccess] = useState<{ manageUrl: string } | null>(null);

  // Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const apiUrl = (path: string) =>
    `${API_BASE}/api/customer/booking/${testDriveId}${path}?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    if (!testDriveId || !token) {
      setError('This link is invalid or incomplete.');
      setLoading(false);
      return;
    }

    fetch(apiUrl(''))
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error.message || 'Could not load booking.');
        } else {
          setBooking(json.data as BookingData);
          setRescheduleDate(json.data.test_drive.scheduled_date || '');
          setRescheduleTime(json.data.test_drive.scheduled_time?.substring(0, 5) || '');
        }
      })
      .catch(() => setError('Failed to load booking. Please try again.'))
      .finally(() => setLoading(false));
  }, [testDriveId, token]);

  const handleCancel = async () => {
    const finalReason = cancelReason === 'Other'
      ? (cancelNote.trim() || 'Cancelled by customer')
      : cancelReason
        ? `${cancelReason}${cancelNote.trim() ? ` — ${cancelNote.trim()}` : ''}`
        : 'Cancelled by customer';
    setIsCancelling(true);
    try {
      const res = await fetch(apiUrl('/cancel'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setBooking((prev) =>
        prev ? { ...prev, test_drive: { ...prev.test_drive, status: 'cancelled', cancelled_reason: finalReason } } : prev,
      );
      setView('details');
      toast({ title: 'Booking cancelled', description: 'Your test drive has been cancelled.' });
    } catch (err: any) {
      toast({ title: 'Cancel failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime) {
      toast({ title: 'Required', description: 'Please select a date and time.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl('/reschedule'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: rescheduleDate, scheduled_time: rescheduleTime + ':00' }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setBooking((prev) =>
        prev
          ? {
              ...prev,
              test_drive: {
                ...prev.test_drive,
                scheduled_date: rescheduleDate,
                scheduled_time: rescheduleTime + ':00',
                status: 'rescheduled',
              },
            }
          : prev,
      );
      toast({ title: 'Rescheduled!', description: `Your test drive has been moved to ${rescheduleDate} at ${rescheduleTime}.` });
      setView('details');
    } catch (err: any) {
      toast({ title: 'Reschedule failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: 'No file selected', description: 'Please choose a file to upload.', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const res = await fetch(apiUrl('/documents'), { method: 'POST', body: form });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setUploadedUrl(json.data?.url || '');
      toast({ title: 'Document uploaded', description: 'Your driving licence has been submitted.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rebookDate || !rebookTime) {
      toast({ title: 'Required', description: 'Please select a date and time.', variant: 'destructive' });
      return;
    }
    setIsRebooking(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/customer/booking/${testDriveId}/rebook?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_date: rebookDate, scheduled_time: rebookTime + ':00' }),
        },
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setRebookSuccess({ manageUrl: json.data.manage_url });
      toast({ title: 'Booking created!', description: `New test drive on ${rebookDate} at ${rebookTime}.` });
    } catch (err: any) {
      toast({ title: 'Booking failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsRebooking(false);
    }
  };

  const isClosed = booking?.test_drive.status === 'cancelled' || booking?.test_drive.status === 'completed';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <Car className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Auto Advant</p>
            <p className="text-xs text-muted-foreground">Manage your test drive booking</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading your booking…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="font-semibold text-foreground">{error}</p>
              <p className="text-sm text-muted-foreground">Please use the link from your confirmation email or contact the showroom.</p>
            </CardContent>
          </Card>
        )}

        {/* Main content */}
        {!loading && booking && (
          <>
            {/* Booking summary card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-heading">Your Test Drive</CardTitle>
                  {(() => {
                    const s = STATUS_LABELS[booking.test_drive.status] || { label: booking.test_drive.status, color: 'bg-muted text-muted-foreground' };
                    return <Badge className={`${s.color} border-0 capitalize`}>{s.label}</Badge>;
                  })()}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {booking.vehicle && (
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">
                      {booking.vehicle.brand} {booking.vehicle.model}
                      {booking.vehicle.variant ? ` ${booking.vehicle.variant}` : ''}
                    </span>
                  </div>
                )}
                {booking.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{booking.location.name}{booking.location.city ? `, ${booking.location.city}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>{booking.test_drive.scheduled_date}</span>
                </div>
                {booking.test_drive.scheduled_time && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{booking.test_drive.scheduled_time.substring(0, 5)}</span>
                  </div>
                )}
                {booking.customer && (
                  <div className="pt-2 border-t border-border text-sm text-muted-foreground">
                    Booked for: <span className="font-medium text-foreground">{booking.customer.full_name}</span>
                  </div>
                )}
                {booking.test_drive.status === 'cancelled' && booking.test_drive.cancelled_reason && (
                  <div className="pt-2 border-t border-border text-sm text-destructive">
                    Reason: {booking.test_drive.cancelled_reason}
                  </div>
                )}
                {/* Pre-set route info (if set at booking time) */}
                {(booking.test_drive as any).metadata?.route_destination && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Planned Route</p>
                    <RouteCalculator
                      originLat={booking.location?.latitude}
                      originLng={booking.location?.longitude}
                      originName={booking.location?.name}
                      defaultDestination={(booking.test_drive as any).metadata.route_destination}
                      defaultDistanceKm={(booking.test_drive as any).metadata.route_distance_km}
                      defaultDurationMinutes={(booking.test_drive as any).metadata.route_duration_minutes}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action buttons (only when booking is active) */}
            {!isClosed && view === 'details' && (
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-12 w-full justify-start gap-3"
                  onClick={() => setView('reschedule')}
                >
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>Reschedule Test Drive</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full justify-start gap-3"
                  onClick={() => setView('upload')}
                >
                  <Upload className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <span>Upload Driving Licence</span>
                    {booking.customer?.driving_license_url && (
                      <p className="text-xs text-green-600 font-normal">Document already on file</p>
                    )}
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full justify-start gap-3 border-destructive/40 text-destructive hover:bg-destructive/5"
                  onClick={() => { setCancelReason(''); setCancelNote(''); setView('cancel'); }}
                >
                  <X className="h-5 w-5" />
                  <span>Cancel Test Drive</span>
                </Button>
              </div>
            )}

            {/* Plan your route (active bookings without a pre-set route) */}
            {!isClosed && view === 'details' && !(booking.test_drive as any).metadata?.route_destination && booking.location?.latitude && booking.location?.longitude && (
              <Card>
                <CardContent className="pt-4 pb-3">
                  <RouteCalculator
                    originLat={booking.location.latitude}
                    originLng={booking.location.longitude}
                    originName={booking.location.name}
                  />
                </CardContent>
              </Card>
            )}

            {/* Completed / cancelled notice */}
            {isClosed && view === 'details' && (
              <div className="space-y-3">
                <Card className="border-muted">
                  <CardContent className="flex items-center gap-3 py-5">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      This booking is <strong>{booking.test_drive.status}</strong> and can no longer be modified.
                    </p>
                  </CardContent>
                </Card>
                {booking.test_drive.status === 'cancelled' && (
                  <Button
                    className="h-12 w-full gap-3"
                    onClick={() => { setRebookDate(''); setRebookTime(''); setRebookSuccess(null); setView('rebook'); }}
                  >
                    <PlusCircle className="h-5 w-5" />
                    Book a New Test Drive
                  </Button>
                )}
              </div>
            )}

            {/* Reschedule form */}
            {view === 'reschedule' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Reschedule Booking</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleReschedule} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rs-date">New Date</Label>
                      <Input
                        id="rs-date"
                        type="date"
                        value={rescheduleDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setRescheduleDate(newDate);
                          // Clear time when switching to today so user picks a valid future slot
                          const todayStr = new Date().toISOString().split('T')[0];
                          if (newDate === todayStr) {
                            setRescheduleTime('');
                          }
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rs-time">New Time</Label>
                      <Input
                        id="rs-time"
                        type="time"
                        min={rescheduleDate === new Date().toISOString().split('T')[0]
                          ? (() => {
                              const now = new Date();
                              // Round up to next 15-min slot
                              now.setMinutes(now.getMinutes() + 15);
                              return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes() - (now.getMinutes() % 15)).padStart(2,'0')}`;
                            })()
                          : undefined}
                        value={rescheduleTime}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        required
                      />
                      {rescheduleDate === new Date().toISOString().split('T')[0] && (
                        <p className="text-xs text-muted-foreground">Only future times are available for today.</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" disabled={isSaving} className="flex-1">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {isSaving ? 'Saving…' : 'Confirm Reschedule'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setView('details')}>
                        Back
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Document upload form */}
            {view === 'upload' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Upload Driving Licence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {uploadedUrl ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                      <p className="font-medium text-foreground">Document uploaded successfully!</p>
                      <p className="text-sm text-muted-foreground">Your driving licence has been received.</p>
                      <Button variant="outline" onClick={() => setView('details')}>Back to Booking</Button>
                    </div>
                  ) : (
                    <form onSubmit={handleUpload} className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Upload a clear photo or scan of your driving licence (JPG, PNG, or PDF).
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="dl-file">Driving Licence File</Label>
                        <Input
                          id="dl-file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button type="submit" disabled={isUploading || !selectedFile} className="flex-1">
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                          {isUploading ? 'Uploading…' : 'Upload Document'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setView('details')}>
                          Back
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cancel form */}
            {view === 'cancel' && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-destructive flex items-center gap-2">
                    <X className="h-5 w-5" />
                    Cancel Test Drive
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">Please let us know why you're cancelling so we can improve our service.</p>

                  {/* Reason options */}
                  <div className="space-y-2">
                    <Label>Reason for cancellation</Label>
                    <div className="space-y-2 pt-1">
                      {(['Change of plans', 'Found a different vehicle', 'Scheduling conflict', 'No longer interested', 'Other'] as const).map((r) => (
                        <label
                          key={r}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${cancelReason === r ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:bg-muted/40'}`}
                        >
                          <input
                            type="radio"
                            name="cancel-reason"
                            value={r}
                            checked={cancelReason === r}
                            onChange={() => setCancelReason(r)}
                            className="accent-destructive"
                          />
                          <span className="text-sm">{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Additional note */}
                  <div className="space-y-2">
                    <Label htmlFor="cancel-note">
                      {cancelReason === 'Other' ? 'Please describe *' : 'Additional notes (optional)'}
                    </Label>
                    <Textarea
                      id="cancel-note"
                      placeholder="Add any details…"
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={isCancelling || !cancelReason || (cancelReason === 'Other' && !cancelNote.trim())}
                      onClick={handleCancel}
                    >
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {isCancelling ? 'Cancelling…' : 'Confirm Cancellation'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setView('details')}>
                      Go Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rebook form */}
            {view === 'rebook' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    Book a New Test Drive
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rebookSuccess ? (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                      <div>
                        <p className="font-semibold text-foreground">Booking confirmed!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your new test drive has been scheduled for the same vehicle and location.
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => { window.location.href = rebookSuccess.manageUrl; }}
                      >
                        View New Booking
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleRebook} className="space-y-4">
                      {booking?.vehicle && (
                        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <Car className="h-4 w-4 text-primary shrink-0" />
                            {booking.vehicle.brand} {booking.vehicle.model}
                            {booking.vehicle.variant ? ` ${booking.vehicle.variant}` : ''}
                          </div>
                          {booking.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4 shrink-0" />
                              {booking.location.name}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground pt-1">Same vehicle and showroom will be pre-selected.</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="rb-date">Date</Label>
                        <Input
                          id="rb-date"
                          type="date"
                          value={rebookDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setRebookDate(newDate);
                            const todayStr = new Date().toISOString().split('T')[0];
                            if (newDate === todayStr) setRebookTime('');
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rb-time">Time</Label>
                        <Input
                          id="rb-time"
                          type="time"
                          min={rebookDate === new Date().toISOString().split('T')[0]
                            ? (() => {
                                const now = new Date();
                                now.setMinutes(now.getMinutes() + 15);
                                return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes() - (now.getMinutes() % 15)).padStart(2,'0')}`;
                              })()
                            : undefined}
                          value={rebookTime}
                          onChange={(e) => setRebookTime(e.target.value)}
                          required
                        />
                        {rebookDate === new Date().toISOString().split('T')[0] && (
                          <p className="text-xs text-muted-foreground">Only future times are available for today.</p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button type="submit" disabled={isRebooking} className="flex-1">
                          {isRebooking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                          {isRebooking ? 'Booking…' : 'Confirm New Booking'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setView('details')}>
                          Back
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground pb-8">
          Need help? Contact the showroom directly.
        </p>
      </div>
    </div>
  );
}
