import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import SiteHeader from '@/components/SiteHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPost } from '@/lib/apiClient';
import { CreditCard, CheckCircle2, MapPin, User, Car } from 'lucide-react';

const CURRENCY_LOCALE_BY_CODE: Record<string, string> = {
  AED: 'en-AE',
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

const resolveCurrencyCode = (currency?: string | null) => {
  const normalized = String(currency || 'AED').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CURRENCY_LOCALE_BY_CODE, normalized) ? normalized : 'AED';
};

const formatCurrencyValue = (value: number, currencyCode?: string | null) => {
  const code = resolveCurrencyCode(currencyCode);
  const locale = CURRENCY_LOCALE_BY_CODE[code] || 'en-AE';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
};

const PaymentPage = () => {
  const router = useRouter();
  const bookingId = typeof router.query.bookingId === 'string' ? router.query.bookingId : '';
  const locationId = typeof router.query.locationId === 'string' ? router.query.locationId : '';
  const initialMode = router.query.mode === 'deposit' ? 'deposit' : 'full';
  const initialProvider = typeof router.query.provider === 'string' ? router.query.provider : 'manual';
  const requestedAmount = Number(typeof router.query.amount === 'string' ? router.query.amount : 0);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    const load = async () => {
      if (!bookingId) {
        setError('Missing booking id.');
        setLoading(false);
        return;
      }
      try {
        const data = await apiGet<any>(`/api/public/car-bookings/${encodeURIComponent(bookingId)}/payment?locationId=${encodeURIComponent(locationId)}`);
        setBooking(data);
        setPaid(data?.payment_status === 'paid');
      } catch (err: any) {
        setError(err?.message || 'Unable to load payment details.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [bookingId, locationId, router.isReady]);

  const currencyCode = booking?.locations?.currency_type || 'AED';
  const resolvedLocationId = booking?.locations?.id || booking?.location_id || locationId || '—';
  const amountToPay = useMemo(() => {
    if (requestedAmount > 0) return requestedAmount;
    if (booking?.payment_requested_amount > 0) return booking.payment_requested_amount;
    return booking?.booking_amount || 0;
  }, [requestedAmount, booking]);

  const handlePayNow = async () => {
    if (!bookingId) return;
    setProcessing(true);
    setError(null);
    try {
      const data = await apiPost<any>(`/api/public/car-bookings/${encodeURIComponent(bookingId)}/payment/complete`, {
        amount: amountToPay,
        mode: initialMode,
        provider: initialProvider,
        locationId,
      });
      setBooking((prev: any) => ({ ...prev, ...data, payment_status: 'paid' }));
      setPaid(true);
    } catch (err: any) {
      setError(err?.message || 'Payment failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader variant="landing" showNav={false} />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-heading">
                <CreditCard className="h-6 w-6 text-primary" /> Booking Payment
              </CardTitle>
              <CardDescription>
                Review your booking information and complete the payment securely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading payment details...</p>
              ) : error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
              ) : booking ? (
                <div className="space-y-5">
                  {paid && (
                    <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 p-4 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-5 w-5" /> Payment successful
                      </div>
                      <p className="mt-1 text-sm">Your payment has been recorded successfully.</p>
                    </div>
                  )}

                  <div className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Payable Amount</p>
                        <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrencyValue(amountToPay, currencyCode)}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{initialMode}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> {booking.customers?.full_name || 'Customer'}</div>
                        <div>{booking.customers?.phone || 'No phone'}</div>
                        <div>{booking.customers?.email || 'No email'}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vehicle</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2"><Car className="h-4 w-4 text-primary" /> {(booking.vehicles?.brand || 'Vehicle')} {booking.vehicles?.model || ''}</div>
                        <div>{booking.vehicles?.variant || 'Variant not listed'}</div>
                        <div>{booking.vehicles?.color || 'Color not listed'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Location</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {booking.locations?.name || 'Showroom'}</div>
                      <div>{booking.locations?.address || booking.locations?.city || 'Address not available'}</div>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handlePayNow} disabled={processing || paid}>
                    {processing ? 'Processing...' : paid ? 'Payment Completed' : 'Pay Now'}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border shadow-card">
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
              <CardDescription>Booking and payment information from the payment link.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Booking ID</span><span className="font-medium text-foreground">{bookingId || '—'}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Location ID</span><span className="font-medium text-foreground">{resolvedLocationId}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Mode</span><span className="font-medium text-foreground capitalize">{initialMode}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium text-foreground">{initialProvider}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium text-foreground">{paid ? 'Paid' : (booking?.payment_status || 'Pending')}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
