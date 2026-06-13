import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiDbQuery, apiPost } from '@/lib/apiClient';
import { Car, Clock3, Star, CheckCircle2 } from 'lucide-react';

type FeedbackBadge = 'Lightning Fast' | 'Smooth Experience' | 'Detailed Guidance' | 'Premium Attention';

const badgeMeta: Record<FeedbackBadge, { className: string; hint: string }> = {
  'Lightning Fast': {
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    hint: 'Completed quickly with efficient support.',
  },
  'Smooth Experience': {
    className: 'bg-blue-100 text-blue-700 border-blue-300',
    hint: 'Well paced and comfortable showroom journey.',
  },
  'Detailed Guidance': {
    className: 'bg-amber-100 text-amber-700 border-amber-300',
    hint: 'Good walkthrough with detailed explanation.',
  },
  'Premium Attention': {
    className: 'bg-violet-100 text-violet-700 border-violet-300',
    hint: 'High-touch guidance and complete assistance.',
  },
};

const getBadgeFromDuration = (durationMinutes: number | null): FeedbackBadge => {
  if (durationMinutes === null) return 'Smooth Experience';
  if (durationMinutes <= 30) return 'Lightning Fast';
  if (durationMinutes <= 60) return 'Smooth Experience';
  if (durationMinutes <= 90) return 'Detailed Guidance';
  return 'Premium Attention';
};

const getDurationMinutes = (td: any): number | null => {
  const start = td?.security_checked_in_at || td?.started_at;
  const end = td?.security_checked_out_at || td?.completed_at;
  if (!start || !end) return null;

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
};

const TestDriveFeedbackPage = () => {
  const [searchParams] = useSearchParams();
  const tdId = searchParams.get('td');
  const queryEnquiryId = searchParams.get('enquiry_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [testDrive, setTestDrive] = useState<any | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      if (!tdId) {
        setLoading(false);
        return;
      }

      const rows = await apiDbQuery<any[]>({
        table: 'test_drives',
        action: 'select',
        select: 'id, customer_id, vehicle_id, location_id, status, scheduled_date, scheduled_time, started_at, completed_at, security_checked_in_at, security_checked_out_at, metadata',
        filters: [{ field: 'id', op: 'eq', value: tdId }],
        limit: 1,
      });

      const drive = rows?.[0] || null;
      if (!drive) {
        setLoading(false);
        return;
      }

      const [customerRows, vehicleRows, locationRows] = await Promise.all([
        drive.customer_id
          ? apiDbQuery<any[]>({
              table: 'customers',
              action: 'select',
              select: 'id, full_name, email, phone',
              filters: [{ field: 'id', op: 'eq', value: drive.customer_id }],
              limit: 1,
            })
          : Promise.resolve([]),
        drive.vehicle_id
          ? apiDbQuery<any[]>({
              table: 'vehicles',
              action: 'select',
              select: 'id, brand, model',
              filters: [{ field: 'id', op: 'eq', value: drive.vehicle_id }],
              limit: 1,
            })
          : Promise.resolve([]),
        drive.location_id
          ? apiDbQuery<any[]>({
              table: 'locations',
              action: 'select',
              select: 'id, name',
              filters: [{ field: 'id', op: 'eq', value: drive.location_id }],
              limit: 1,
            })
          : Promise.resolve([]),
      ]);

      const data = {
        ...drive,
        customers: customerRows?.[0] || null,
        vehicles: vehicleRows?.[0] || null,
        locations: locationRows?.[0] || null,
      };

      setTestDrive(data);
      setCustomerName(data?.customers?.full_name || '');
      setCustomerEmail(data?.customers?.email || '');
      setCustomerPhone(data?.customers?.phone || '');
      setLoading(false);
    };

    load();
  }, [tdId, toast]);

  const durationMinutes = useMemo(() => getDurationMinutes(testDrive), [testDrive]);
  const systemBadge = useMemo(() => getBadgeFromDuration(durationMinutes), [durationMinutes]);
  const enquiryId = (testDrive?.metadata as any)?.enquiry_id || queryEnquiryId || null;

  const submitFeedback = async () => {
    if (!tdId || !testDrive) return;
    if (!customerName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/api/public/feedback', {
        test_drive_id: tdId,
        customer_id: testDrive.customer_id,
        enquiry_id: enquiryId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        rating,
        experience_badge: systemBadge,
        total_duration_minutes: durationMinutes,
        feedback_text: feedbackText.trim() || null,
        would_recommend: wouldRecommend,
      });

      setSubmitted(true);
      toast({ title: 'Feedback submitted', description: 'Thank you for sharing your test drive experience.' });
    } catch (error: any) {
      toast({ title: 'Failed to submit feedback', description: error?.message || 'Unable to submit feedback', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-lg">
          <CardContent className="p-8 text-center text-muted-foreground">Loading your test drive details...</CardContent>
        </Card>
      </div>
    );
  }

  if (!tdId || !testDrive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-lg">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-foreground">Invalid feedback link</p>
            <p className="text-sm text-muted-foreground mt-2">Please use the feedback link sent in your journey email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="shadow-xl border-primary/20">
          <CardHeader className="space-y-3">
            <Badge className="w-fit bg-primary/10 text-primary border-primary/30">Auto Advant Feedback</Badge>
            <CardTitle className="text-2xl">Share Your Test Drive Journey Feedback</CardTitle>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2"><Car className="h-4 w-4" />
                {testDrive.vehicles?.brand} {testDrive.vehicles?.model}
              </div>
              <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />
                {durationMinutes === null ? 'Duration not captured yet' : `Total showroom journey time: ${durationMinutes} minutes`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className={badgeMeta[systemBadge].className}>{systemBadge}</Badge>
              {enquiryId && <Badge variant="outline">Enquiry ID: {enquiryId}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{badgeMeta[systemBadge].hint}</p>
          </CardHeader>
        </Card>

        {submitted ? (
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="text-lg font-semibold">Thank you for your feedback</p>
              <p className="text-sm text-muted-foreground">Your response has been saved successfully.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardContent className="p-6 md:p-8 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Your phone" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="you@example.com" />
              </div>

              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={rating === n ? 'default' : 'outline'}
                      onClick={() => setRating(n)}
                      className="gap-1"
                    >
                      <Star className={`h-4 w-4 ${rating >= n ? 'fill-current' : ''}`} /> {n}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tell us about your experience</Label>
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What did you like? What can we improve?"
                  rows={5}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={wouldRecommend ? 'default' : 'outline'}
                  onClick={() => setWouldRecommend(true)}
                >
                  I would recommend this showroom
                </Button>
                <Button
                  type="button"
                  variant={!wouldRecommend ? 'default' : 'outline'}
                  onClick={() => setWouldRecommend(false)}
                >
                  Needs improvement
                </Button>
              </div>

              <Button onClick={submitFeedback} disabled={submitting} className="w-full">
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestDriveFeedbackPage;
