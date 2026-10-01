import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiGet, apiPatch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import VehicleImage from '@/components/common/VehicleImage';
import {
  BookOpen, Car, User, CreditCard, Banknote, Link2, XCircle, RotateCcw,
  AlertTriangle, CheckCircle2, Filter, Search, MapPin, CalendarDays
} from 'lucide-react';
import { logStaffActivity } from '@/lib/activityLogger';
import {
  getCarBookingPaymentConfig,
  type CarBookingPaymentConfig,
} from '@/lib/carBookingPaymentConfigService';

const BOOKING_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  refunded:  'bg-warning/10 text-warning border-warning/20',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending:        'bg-muted text-muted-foreground',
  paid:           'bg-success/10 text-success',
  refunded:       'bg-warning/10 text-warning',
  partial_refund: 'bg-info/10 text-info',
};

const CURRENCY_LOCALE_BY_CODE: Record<string, string> = {
  AED: 'en-AE',
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

const resolveCurrencyCode = (currency?: string | null) => {
  const normalized = (currency || 'AED').trim().toUpperCase();
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

const formatBookingDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const getBookingVehicle = (booking: any) => booking?.vehicles || booking?.testDrive?.vehicle || null;

const getBookingVehicleTitle = (booking: any) => {
  const vehicle = getBookingVehicle(booking);
  if (vehicle?.brand || vehicle?.model) {
    return `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim();
  }
  return 'Vehicle not linked';
};

const getBookingVehicleSubtitle = (booking: any) => {
  const vehicle = getBookingVehicle(booking);
  const variant = vehicle?.variant?.trim();
  const color = vehicle?.color?.trim();

  if (variant && color) return `${variant} • ${color}`;
  if (variant) return variant;
  if (color) return color;

  if (booking?.vehicleSource === 'test_drive_vehicle') return 'Test drive vehicle';
  if (booking?.vehicleSource === 'sales_vehicle') return 'Sales vehicle';
  return 'Vehicle details unavailable';
};

const getBookingVehicleImageUrl = (booking: any) => {
  const vehicle = getBookingVehicle(booking);
  return vehicle?.image_url || null;
};

const getBookingVehicleSourceLabel = (booking: any) => {
  if (booking?.vehicleSource === 'test_drive_vehicle') return 'Test Drive Vehicle';
  if (booking?.vehicleSource === 'sales_vehicle') return 'Sales Vehicle';
  return '';
};

const getBookingVehicleSourceClass = (booking: any) => {
  if (booking?.vehicleSource === 'test_drive_vehicle') return 'bg-info/10 text-info border-info/20';
  if (booking?.vehicleSource === 'sales_vehicle') return 'bg-success/10 text-success border-success/20';
  return 'bg-muted text-muted-foreground border-border';
};

export default function CarBookingsPage() {
  const router = useRouter();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'refunded'>('all');
  const [search, setSearch] = useState('');
  const [currencyCode, setCurrencyCode] = useState('AED');
  const [paymentConfig, setPaymentConfig] = useState<CarBookingPaymentConfig | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    booking: any | null;
  }>({ open: false, booking: null });
  const [paymentMode, setPaymentMode] = useState<'deposit' | 'full'>('deposit');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [emailingBookingId, setEmailingBookingId] = useState<string | null>(null);

  // Cancel/Refund dialog
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    booking: any | null;
    mode: 'cancel' | 'refund';
  }>({ open: false, booking: null, mode: 'cancel' });
  const [actionReason, setActionReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);

  const canManage = role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN || role === APP_ROLE.SUPERADMIN;
  const isSales = role === APP_ROLE.SALES;

  useEffect(() => { fetchBookings(); }, [role, profile?.id]);
  useEffect(() => { void fetchPaymentConfig(); }, [profile?.location_id]);

  const fetchPaymentConfig = async () => {
    const locationId = profile?.location_id;
    if (!locationId) return;
    try {
      const row = await getCarBookingPaymentConfig(locationId);
      setPaymentConfig(row);
      setPaymentMode(row?.default_collection_mode === 'full' ? 'full' : 'deposit');
    } catch {
      setPaymentConfig(null);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isSales && profile?.id) {
        params.set('sales_person_profile_id', profile.id);
      }

      const rows = await apiGet<any[]>(`/api/car-bookings?${params.toString()}`);
      setBookings(rows || []);

      let nextCurrencyCode = 'AED';
      const locationId = profile?.location_id || rows?.[0]?.location_id || rows?.[0]?.locations?.id;
      if (locationId) {
        try {
          const locations = await apiGet<any[]>(`/api/locations?ids=${encodeURIComponent(String(locationId))}&is_active=true`);
          const location = Array.isArray(locations) ? locations[0] : null;
          const rowCurrency = location?.currency_type || rows?.[0]?.locations?.currency_type;
          nextCurrencyCode = resolveCurrencyCode(rowCurrency);
        } catch {
          nextCurrencyCode = resolveCurrencyCode(rows?.[0]?.locations?.currency_type || 'AED');
        }
      }
      setCurrencyCode(nextCurrencyCode);
    } catch (err: any) {
      toast({ title: 'Failed to load bookings', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openAction = (booking: any, mode: 'cancel' | 'refund') => {
    setActionDialog({ open: true, booking, mode });
    setActionReason('');
    setRefundAmount(mode === 'refund' ? String(booking.booking_amount || '') : '');
  };

  const handleAction = async () => {
    const { booking, mode } = actionDialog;
    if (!booking || !actionReason.trim()) {
      toast({ title: 'Please enter a reason', variant: 'destructive' }); return;
    }
    if (mode === 'refund') {
      const amt = parseFloat(refundAmount);
      if (!refundAmount || isNaN(amt) || amt < 0) {
        toast({ title: 'Enter a valid refund amount', variant: 'destructive' }); return;
      }
    }
    setActionProcessing(true);
    try {
      const refAmt = mode === 'refund' ? parseFloat(refundAmount) : undefined;

      const actionPayload: Record<string, unknown> = {
        action: mode,
        cancellation_reason: actionReason.trim(),
        cancelled_by_profile_id: profile?.id || null,
      };
      if (mode === 'refund') {
        actionPayload.refund_amount = refAmt;
        actionPayload.refund_notes = actionReason.trim();
      }

      await apiPatch(`/api/car-bookings/${booking.id}`, actionPayload);

      // --- Activity log ---
      if (user?.id) {
        await logStaffActivity({
          userId: user.id,
          profileId: profile?.id,
          locationId: profile?.location_id,
          role: role || 'sales',
          eventType: mode === 'cancel' ? 'car_booking_cancelled' : 'car_booking_refunded',
          label: `Car booking ${mode === 'cancel' ? 'cancelled' : 'refunded'} — ${booking.vehicles?.brand} ${booking.vehicles?.model}`,
          metadata: { bookingId: booking.id, reason: actionReason.trim(), refundAmount: refAmt },
        });
      }

      toast({
        title: mode === 'cancel' ? 'Booking cancelled' : 'Refund processed',
        description: 'Notification email sent to customer.',
      });
      setActionDialog({ open: false, booking: null, mode: 'cancel' });
      fetchBookings();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.message, variant: 'destructive' });
    } finally {
      setActionProcessing(false);
    }
  };

  const openCustomer360 = (customerId?: string | null) => {
    if (!customerId) return;
    void router.push(`/customers/${encodeURIComponent(customerId)}`);
  };

  const openPaymentDialog = (booking: any) => {
    const defaultMode = paymentConfig?.default_collection_mode === 'full' ? 'full' : 'deposit';
    setPaymentMode(defaultMode);
    setPaymentDialog({ open: true, booking });
  };

  const getRequestedAmountPreview = () => {
    const bookingAmount = Number(paymentDialog.booking?.booking_amount || 0);
    if (!(bookingAmount > 0)) return 0;
    if (paymentMode === 'full') return bookingAmount;

    const config = paymentConfig;
    if (!config) return Math.round((bookingAmount * 10) / 100);
    if (config.deposit_type === 'fixed') {
      return Math.min(bookingAmount, Math.max(0, Number(config.deposit_value || 0)));
    }
    const pct = Math.max(1, Math.min(100, Number(config.deposit_value || 10)));
    return Math.round((bookingAmount * pct) / 100);
  };

  const handleGeneratePaymentLink = async () => {
    const booking = paymentDialog.booking;
    if (!booking?.id) return;
    const isRegenerate = Boolean(booking.payment_link);

    setPaymentProcessing(true);
    try {
      await apiPatch(`/api/car-bookings/${encodeURIComponent(booking.id)}`, {
        action: isRegenerate ? 'regenerate_payment_link' : 'generate_payment_link',
        payment_mode: paymentMode,
      });

      toast({ title: isRegenerate ? 'Payment link regenerated successfully' : 'Payment link generated successfully' });
      setPaymentDialog({ open: false, booking: null });
      await fetchBookings();
    } catch (err: any) {
      toast({
        title: 'Failed to generate payment link',
        description: err?.message || 'Please review payment settings and try again.',
        variant: 'destructive',
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleEmailPaymentLink = async (booking: any) => {
    if (!booking?.id) return;

    setEmailingBookingId(booking.id);
    try {
      await apiPatch(`/api/car-bookings/${encodeURIComponent(booking.id)}`, {
        action: 'email_payment_link',
      });

      toast({ title: 'Payment link sent to customer email' });
    } catch (err: any) {
      toast({
        title: 'Failed to send payment link email',
        description: err?.message || 'Please verify customer email and payment link.',
        variant: 'destructive',
      });
    } finally {
      setEmailingBookingId(null);
    }
  };

  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.booking_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.customers?.full_name?.toLowerCase().includes(q) ||
        b.customers?.phone?.includes(q) ||
        b.vehicles?.brand?.toLowerCase().includes(q) ||
        b.vehicles?.model?.toLowerCase().includes(q) ||
        b.salesPerson?.full_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // KPIs
  const totalConfirmed = bookings.filter(b => b.booking_status === 'confirmed').length;
  const totalAmount    = bookings.filter(b => b.booking_status === 'confirmed').reduce((s, b) => s + Number(b.booking_amount || 0), 0);
  const totalCancelled = bookings.filter(b => b.booking_status === 'cancelled').length;
  const totalRefunded  = bookings.filter(b => b.booking_status === 'refunded').reduce((s, b) => s + Number(b.refund_amount || 0), 0);

  return (
    <DashboardLayout>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-r from-slate-100/80 via-white/70 to-amber-100/70 p-4 sm:p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-800/70">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-white/30 to-transparent dark:from-white/5" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" /> Car Bookings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage purchase bookings, payments, cancellations and refunds.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="h-9 w-9 rounded-full border border-border/60 bg-white/70 backdrop-blur-md flex items-center justify-center dark:bg-slate-900/60">
              <Filter className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="h-9 w-9 rounded-full border border-border/60 bg-white/70 backdrop-blur-md flex items-center justify-center dark:bg-slate-900/60">
              <Search className="h-4 w-4 text-muted-foreground" />
            </span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="-mt-3 sm:-mt-5 relative z-10 grid grid-cols-2 xl:grid-cols-4 gap-3 px-1 sm:px-3">
        {[
          { label: 'Active Bookings', value: totalConfirmed, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', icon: CheckCircle2 },
          { label: 'Total Collected', value: formatCurrencyValue(totalAmount, currencyCode), color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', icon: Banknote },
          { label: 'Cancellations', value: totalCancelled, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', icon: XCircle },
          { label: 'Refunds Given', value: formatCurrencyValue(totalRefunded, currencyCode), color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', icon: RotateCcw },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`shadow-[0_14px_35px_rgba(15,23,42,0.08)] border ${stat.border} bg-white/75 backdrop-blur-xl dark:bg-slate-900/75`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{stat.label}</p>
                  <p className="text-xl font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search customer, vehicle, sales person…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bookings</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bookings Row Grid */}
      <Card className="shadow-card border-0 bg-muted/20">
        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground text-sm">Loading bookings…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm">No bookings found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <div className="min-w-[1100px]">
                <div className="grid grid-cols-[1.2fr_1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 border-b bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Customer</span>
                  <span>Vehicle</span>
                  <span>Amount</span>
                  <span>Booking</span>
                  <span>Payment</span>
                  <span>Location</span>
                  <span>Date</span>
                </div>
                <div className="max-h-[66vh] overflow-y-auto">
                  {filtered.map((b) => (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBooking(b)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedBooking(b);
                        }
                      }}
                      className="grid grid-cols-[1.2fr_1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-2 border-b px-3 py-2.5 text-sm transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{b.customers?.full_name || '—'}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.customers?.phone || 'No phone'}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <VehicleImage
                            imageUrl={getBookingVehicleImageUrl(b)}
                            brand={getBookingVehicle(b)?.brand}
                            model={getBookingVehicle(b)?.model}
                            className="h-10 w-16 rounded-md object-cover"
                          />
                          <p className="truncate font-medium text-foreground">{getBookingVehicleTitle(b)}</p>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <p className="truncate text-xs text-muted-foreground">{getBookingVehicleSubtitle(b)}</p>
                        
                        </div>
                      </div>
                      <p className="truncate font-semibold text-foreground">{formatCurrencyValue(Number(b.booking_amount || 0), b.locations?.currency_type || currencyCode)}</p>
                      <Badge variant="outline" className={`w-fit text-[10px] ${BOOKING_STATUS_COLORS[b.booking_status]}`}>{b.booking_status}</Badge>
                      <Badge variant="secondary" className={`w-fit text-[10px] ${PAYMENT_STATUS_COLORS[b.payment_status]}`}>{(b?.payment_status || 'pending').replace('_', ' ')}</Badge>
                      <p className="truncate text-sm text-foreground">{b.locations?.name || 'No location'}</p>
                      <p className="text-sm text-muted-foreground">{formatBookingDate(b.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedBooking)} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">Booking Details</SheetTitle>
            <SheetDescription>
              {selectedBooking?.customers?.full_name || 'Customer'} • {getBookingVehicleTitle(selectedBooking)}
            </SheetDescription>
          </SheetHeader>

          {selectedBooking && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Booking Amount</p>
                <p className="text-2xl font-heading font-bold text-foreground mt-1">
                  {formatCurrencyValue(Number(selectedBooking.booking_amount || 0), selectedBooking.locations?.currency_type || currencyCode)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedBooking.customers?.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{selectedBooking.customers?.phone || 'No phone'}</p>
                  <p className="text-xs text-muted-foreground break-all">{selectedBooking.customers?.email || 'No email'}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicle</p>
                  <div className="mt-2 mb-2">
                    <VehicleImage
                      imageUrl={getBookingVehicleImageUrl(selectedBooking)}
                      brand={getBookingVehicle(selectedBooking)?.brand}
                      model={getBookingVehicle(selectedBooking)?.model}
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">{getBookingVehicleTitle(selectedBooking)}</p>
                  <p className="text-xs text-muted-foreground">{getBookingVehicleSubtitle(selectedBooking)}</p>
                 
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Booking status</span>
                  <Badge variant="outline" className={BOOKING_STATUS_COLORS[selectedBooking.booking_status]}>{selectedBooking.booking_status}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Payment status</span>
                  <Badge variant="secondary" className={PAYMENT_STATUS_COLORS[selectedBooking.payment_status]}>{(selectedBooking.payment_status || 'pending').replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Payment method</span>
                  <span className="font-medium text-foreground">{selectedBooking.payment_method === 'cash' ? 'Cash' : 'Card / Link'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-foreground">{selectedBooking.locations?.name || '—'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Created on</span>
                  <span className="font-medium text-foreground">{formatBookingDate(selectedBooking.created_at)}</span>
                </div>
              </div>

              {(selectedBooking.insurance_provider || selectedBooking.finance_provider || selectedBooking.financing_plan || selectedBooking.deal_status) && (
                <div className="rounded-xl border border-info/20 bg-info/5 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Deal Details</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {selectedBooking.insurance_provider && <span className="rounded-full border bg-background px-2 py-1">Ins: {selectedBooking.insurance_provider}</span>}
                    {selectedBooking.finance_provider && <span className="rounded-full border bg-background px-2 py-1">Finance: {selectedBooking.finance_provider}</span>}
                    {selectedBooking.financing_plan && <span className="rounded-full border bg-background px-2 py-1">Plan: {selectedBooking.financing_plan}</span>}
                    {selectedBooking.deal_status && <span className="rounded-full border bg-background px-2 py-1">Deal: {selectedBooking.deal_status}</span>}
                  </div>
                </div>
              )}

              {selectedBooking.payment_link && (
                <a
                  href={selectedBooking.payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  Open payment link
                </a>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => openCustomer360(selectedBooking.customer_id || selectedBooking.customers?.id)}>
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Customer 360
                </Button>
                {canManage && selectedBooking.booking_status === 'confirmed' && (
                  <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => openPaymentDialog(selectedBooking)}>
                    <Link2 className="h-3.5 w-3.5 mr-1" /> {selectedBooking.payment_link ? 'Regenerate Link' : 'Generate Link'}
                  </Button>
                )}
                {canManage && selectedBooking.booking_status === 'confirmed' && selectedBooking.payment_link && selectedBooking.customers?.email && (
                  <Button
                    variant="outline"
                    className="border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/40"
                    onClick={() => handleEmailPaymentLink(selectedBooking)}
                    disabled={emailingBookingId === selectedBooking.id}
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1" /> {emailingBookingId === selectedBooking.id ? 'Sending...' : 'Email Link'}
                  </Button>
                )}
                {canManage && selectedBooking.booking_status === 'confirmed' && (
                  <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => openAction(selectedBooking, 'cancel')}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel Booking
                  </Button>
                )}
                {canManage && selectedBooking.booking_status === 'confirmed' && (
                  <Button variant="outline" className="border-warning/40 text-warning hover:bg-warning/10" onClick={() => openAction(selectedBooking, 'refund')}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Process Refund
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel / Refund Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(o) => !o && setActionDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              {actionDialog.mode === 'cancel' ? (
                <><XCircle className="h-5 w-5 text-destructive" /> Cancel Booking</>
              ) : (
                <><RotateCcw className="h-5 w-5 text-warning" /> Process Refund</>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.booking?.customers?.full_name} • {actionDialog.booking?.vehicles?.brand} {actionDialog.booking?.vehicles?.model}
              {' '}• {formatCurrencyValue(Number(actionDialog.booking?.booking_amount || 0), actionDialog.booking?.locations?.currency_type || currencyCode)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                {actionDialog.mode === 'cancel'
                  ? 'This will cancel the booking. An email notification will be sent to the customer.'
                  : 'This will process a refund. The customer and Organization Admin will be notified by email.'}
              </p>
            </div>

            {actionDialog.mode === 'refund' && (
              <div className="space-y-2">
                <Label>Refund Amount ({resolveCurrencyCode(actionDialog.booking?.locations?.currency_type || currencyCode)})</Label>
                <Input
                  type="number"
                  min="0"
                  max={actionDialog.booking?.booking_amount}
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  placeholder={`Max ${formatCurrencyValue(Number(actionDialog.booking?.booking_amount || 0), actionDialog.booking?.locations?.currency_type || currencyCode)}`}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason / Comments <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder={
                  actionDialog.mode === 'cancel'
                    ? 'e.g. Customer changed their mind, preferred a different model…'
                    : 'e.g. Customer cancelled order, finance not approved…'
                }
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setActionDialog(prev => ({ ...prev, open: false }))}
                disabled={actionProcessing}
              >
                Back
              </Button>
              <Button
                className={`flex-1 ${actionDialog.mode === 'cancel' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-warning text-warning-foreground hover:bg-warning/90'}`}
                onClick={handleAction}
                disabled={actionProcessing || !actionReason.trim()}
              >
                {actionProcessing ? 'Processing…' : actionDialog.mode === 'cancel' ? 'Confirm Cancel' : 'Confirm Refund'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Link Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(o) => !o && setPaymentDialog({ open: false, booking: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <CreditCard className="h-5 w-5 text-primary" /> {paymentDialog.booking?.payment_link ? 'Regenerate Payment Link' : 'Generate Payment Link'}
            </DialogTitle>
            <DialogDescription>
              {paymentDialog.booking?.customers?.full_name} • {paymentDialog.booking?.vehicles?.brand} {paymentDialog.booking?.vehicles?.model}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!paymentConfig?.payment_module_enabled && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                Payment module is currently disabled for this location. Enable it from Settings &gt; Car Booking Payments.
              </div>
            )}

            <div className="space-y-2">
              <Label>Collection mode</Label>
              <Select value={paymentMode} onValueChange={(v: 'deposit' | 'full') => setPaymentMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit" disabled={paymentConfig?.allow_deposit === false}>Deposit</SelectItem>
                  <SelectItem value="full" disabled={paymentConfig?.allow_full_payment === false}>Full amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">Requested amount</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrencyValue(getRequestedAmountPreview(), paymentDialog.booking?.locations?.currency_type || currencyCode)}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentDialog({ open: false, booking: null })}
                disabled={paymentProcessing}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleGeneratePaymentLink}
                disabled={paymentProcessing || !paymentConfig?.payment_module_enabled}
              >
                {paymentProcessing ? 'Processing…' : paymentDialog.booking?.payment_link ? 'Regenerate Link' : 'Generate Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
