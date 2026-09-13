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
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen, Car, User, CreditCard, Banknote, Link2, XCircle, RotateCcw,
  Calendar, Phone, AlertTriangle, CheckCircle2, Filter, Search
} from 'lucide-react';
import { logStaffActivity } from '@/lib/activityLogger';

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

export default function CarBookingsPage() {
  const router = useRouter();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'refunded'>('all');
  const [search, setSearch] = useState('');
  const [currencyCode, setCurrencyCode] = useState('AED');

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
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Car Bookings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage purchase bookings, payments, cancellations and refunds.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Active Bookings', value: totalConfirmed, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', icon: CheckCircle2 },
          { label: 'Total Collected', value: formatCurrencyValue(totalAmount, currencyCode), color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', icon: Banknote },
          { label: 'Cancellations', value: totalCancelled, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', icon: XCircle },
          { label: 'Refunds Given', value: formatCurrencyValue(totalRefunded, currencyCode), color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', icon: RotateCcw },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`shadow-card border ${stat.border}`}>
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

      {/* Bookings Cards */}
      <Card className="shadow-card border-0 bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/40">
        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground text-sm">Loading bookings…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm">No bookings found.</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((b) => (
                <div
                  key={b.id}
                  className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(124,58,237,0.15)] dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 p-4 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-violet-100">Booking</p>
                        <p className="mt-2 text-lg font-bold">{formatCurrencyValue(Number(b.booking_amount || 0), b.locations?.currency_type || currencyCode)}</p>
                      </div>
                      <div className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium ring-1 ring-white/20 backdrop-blur-sm">
                        {b.payment_method === 'cash' ? 'Cash' : 'Card'}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[11px] text-violet-100">
                      <span>{b.customers?.full_name || 'Customer'}</span>
                      <span>{formatBookingDate(b.created_at)}</span>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                          <Car className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{b.vehicles?.brand || '—'} {b.vehicles?.model || ''}</p>
                          <p className="text-[11px] text-muted-foreground">{b.vehicles?.variant || 'Variant not listed'}{b.vehicles?.color ? ` • ${b.vehicles.color}` : ''}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${BOOKING_STATUS_COLORS[b.booking_status]}`}>
                        {b.booking_status}
                      </Badge>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Customer</p>
                        <div className="mt-2 flex items-start gap-2">
                          <User className="mt-0.5 h-3.5 w-3.5 text-violet-500" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{b.customers?.full_name || '—'}</p>
                            <p className="text-[11px] text-muted-foreground">{b.customers?.phone || 'No phone'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Payment</p>
                        <div className="mt-2 flex items-start gap-2">
                          {b.payment_method === 'cash' ? <Banknote className="mt-0.5 h-3.5 w-3.5 text-emerald-500" /> : <CreditCard className="mt-0.5 h-3.5 w-3.5 text-violet-500" />}
                          <div>
                            <p className="text-sm font-medium text-foreground">{b.payment_method === 'cash' ? 'Cash' : 'Card / Link'}</p>
                            <Badge variant="secondary" className={`mt-1 text-[10px] hover:bg-slate-50/80 ${PAYMENT_STATUS_COLORS[b.payment_status]}`}>
                              {b?.payment_status?.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 dark:border-slate-800 dark:from-slate-950/50 dark:to-slate-900">
                      {b.salesPerson?.full_name && (
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                          <span>Sales</span>
                          <span className="font-medium text-foreground">{b.salesPerson.full_name}</span>
                        </div>
                      )}
                      {b.locations?.name && (
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                          <span>Location</span>
                          <span className="font-medium text-foreground">{b.locations.name}</span>
                        </div>
                      )}
                      {b.testDrive && (
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                          <span>Test drive</span>
                          <span className="font-medium text-foreground">{b.testDrive.scheduled_date || 'Scheduled'}</span>
                        </div>
                      )}
                    </div>

                    {(b.insurance_provider || b.finance_provider || b.financing_plan || b.deal_status) && (
                      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Deal details</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {b.insurance_provider && <span className="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">Ins: {b.insurance_provider}</span>}
                          {b.finance_provider && <span className="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">Finance: {b.finance_provider}</span>}
                          {b.financing_plan && <span className="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">Plan: {b.financing_plan}</span>}
                          {b.deal_status && <span className="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">Deal: {b.deal_status}</span>}
                        </div>
                      </div>
                    )}

                    {b.booking_status === 'refunded' && b.refund_amount > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                        Refund: {formatCurrencyValue(Number(b.refund_amount || 0), b.locations?.currency_type || currencyCode)}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
                        onClick={() => openCustomer360(b.customer_id || b.customers?.id)}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" /> Customer 360
                      </Button>
                      {canManage && b.booking_status === 'confirmed' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => openAction(b, 'cancel')}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-warning/40 text-warning hover:bg-warning/10"
                            onClick={() => openAction(b, 'refund')}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Refund
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
    </DashboardLayout>
  );
}
