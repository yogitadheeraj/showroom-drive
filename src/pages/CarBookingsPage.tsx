import { useEffect, useState } from 'react';
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

      {/* Bookings Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground text-sm">Loading bookings…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm">No bookings found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-background">
              <table className="w-full min-w-[950px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-gradient-to-r from-slate-50 via-slate-50 to-white text-left dark:from-slate-900/80 dark:via-slate-900/80 dark:to-slate-950/80">
                    <th className="p-3 font-semibold text-foreground">Customer</th>
                    <th className="p-3 font-semibold text-foreground">Vehicle</th>
                    <th className="p-3 font-semibold text-foreground">Deal</th>
                    <th className="p-3 font-semibold text-foreground">Amount</th>
                    <th className="p-3 font-semibold text-foreground">Status</th>
                    <th className="p-3 font-semibold text-foreground">Date</th>
                    {canManage && <th className="p-3 font-semibold text-foreground text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-border/60 align-top transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                      <td className="p-3">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{b.customers?.full_name || '—'}</p>
                            {b.customers?.phone && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{b.customers.phone}</span>
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                              {b.salesPerson?.full_name && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">Sales: {b.salesPerson.full_name}</span>}
                              {b.locations?.name && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{b.locations.name}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60">
                            <Car className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{b.vehicles?.brand || '—'} {b.vehicles?.model || ''}</p>
                            {(b.vehicles?.variant || b.vehicles?.color) && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {b.vehicles?.variant || 'Variant not listed'}{b.vehicles?.color ? ` • ${b.vehicles.color}` : ''}
                              </p>
                            )}
                            {b.testDrive && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{b.testDrive.scheduled_date || 'Test drive scheduled'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        {(b.insurance_provider || b.finance_provider || b.financing_plan || b.deal_status) ? (
                          <div className="space-y-1 rounded-lg border border-border/70 bg-slate-50/80 p-2 text-[11px] text-muted-foreground dark:bg-slate-900/30">
                            {b.insurance_provider && <div><span className="font-medium text-foreground">Ins:</span> {b.insurance_provider}</div>}
                            {b.finance_provider && <div><span className="font-medium text-foreground">Finance:</span> {b.finance_provider}</div>}
                            {b.financing_plan && <div><span className="font-medium text-foreground">Plan:</span> {b.financing_plan}</div>}
                            {b.deal_status && <div><span className="font-medium text-foreground">Deal:</span> {b.deal_status}</div>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No finance details</span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="rounded-lg border border-primary/10 bg-primary/5 p-2.5">
                          <p className="font-semibold text-foreground">{formatCurrencyValue(Number(b.booking_amount || 0), b.locations?.currency_type || currencyCode)}</p>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            {b.payment_method === 'cash' ? <Banknote className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5 text-primary" />}
                            <span>{b.payment_method === 'cash' ? 'Cash' : 'Link'}</span>
                          </div>
                          <Badge variant="secondary" className={`mt-1.5 text-[10px] ${PAYMENT_STATUS_COLORS[b.payment_status]}`}>
                            {b?.payment_status?.replace('_', ' ')}
                          </Badge>
                          {b.booking_status === 'refunded' && b.refund_amount > 0 && (
                            <p className="mt-1 text-[11px] text-warning">Refund: {formatCurrencyValue(Number(b.refund_amount || 0), b.locations?.currency_type || currencyCode)}</p>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="space-y-2">
                          <Badge variant="outline" className={`text-xs ${BOOKING_STATUS_COLORS[b.booking_status]}`}>
                            {b.booking_status}
                          </Badge>
                          {b.cancellation_reason && (
                            <p className="max-w-[180px] truncate text-[11px] text-muted-foreground" title={b.cancellation_reason}>
                              {b.cancellation_reason}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatBookingDate(b.created_at)}
                      </td>

                      {canManage && (
                        <td className="p-3">
                          {b.booking_status === 'confirmed' ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-full max-w-[120px] text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                                onClick={() => openAction(b, 'cancel')}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-full max-w-[120px] text-xs border-warning/40 text-warning hover:bg-warning/10"
                                onClick={() => openAction(b, 'refund')}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Refund
                              </Button>
                            </div>
                          ) : (
                            <span className="block text-right text-[11px] text-muted-foreground">No actions</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
