import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/apiClient';
import { listStaffServiceBookings, updateServiceProgress } from '@/lib/serviceBookingService';
import { Wrench, RefreshCw } from 'lucide-react';

type ServiceProgressPanelProps = {
  title?: string;
};

const STATUS_OPTIONS = [
  'booked',
  'confirmed',
  'in_progress',
  'ready_for_delivery',
  'completed',
  'cancelled',
  'rescheduled',
];

const STATUS_GROUP_ORDER = ['booked', 'confirmed', 'in_progress', 'ready_for_delivery', 'completed', 'rescheduled', 'cancelled'];

const PAYMENT_STATUS_OPTIONS = ['pending', 'partial', 'paid'];

export default function ServiceProgressPanel({ title = 'Service Appointment Progress' }: ServiceProgressPanelProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceExperts, setServiceExperts] = useState<Array<{ id: string; full_name: string }>>([]);
  const [progressDraft, setProgressDraft] = useState<Record<string, { status: string; progress_step: string; payment_status: string; assigned_service_expert_profile_id: string; note: string }>>({});

  const loadServiceExperts = async () => {
    try {
      const profiles = await apiGet<any[]>('/api/profiles?role=service_expert&is_active=true');
      setServiceExperts((profiles || []).map((profile: any) => ({ id: profile.id, full_name: profile.full_name || 'Service Expert' })));
    } catch {
      setServiceExperts([]);
    }
  };

  const loadRows = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      const data = await listStaffServiceBookings(filters);
      setRows(data || []);
    } catch (error: any) {
      toast({ title: 'Failed to load service appointments', description: error?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [statusFilter]);

  useEffect(() => {
    void loadServiceExperts();
  }, []);

  useEffect(() => {
    const handleBookingUpdated = () => {
      void loadRows();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('service-booking-updated', handleBookingUpdated);
      return () => window.removeEventListener('service-booking-updated', handleBookingUpdated);
    }

    return undefined;
  }, []);

  const orderedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const left = `${a.appointment_date || ''} ${a.appointment_time || ''}`;
      const right = `${b.appointment_date || ''} ${b.appointment_time || ''}`;
      return right.localeCompare(left);
    });
  }, [rows]);

  const overviewStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const statusCounts = rows.reduce((acc, row) => {
      const status = String(row.status || 'booked');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = rows.length;
    const completed = statusCounts.completed || 0;
    const inProgress = (statusCounts.in_progress || 0) + (statusCounts.ready_for_delivery || 0);
    const pendingAction = (statusCounts.booked || 0) + (statusCounts.confirmed || 0);
    const todayCount = rows.filter((row) => row.appointment_date === today).length;

    return {
      total,
      booked: statusCounts.booked || 0,
      confirmed: statusCounts.confirmed || 0,
      inProgress,
      readyForDelivery: statusCounts.ready_for_delivery || 0,
      completed,
      cancelled: statusCounts.cancelled || 0,
      rescheduled: statusCounts.rescheduled || 0,
      pendingAction,
      todayCount,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [rows]);

  const overviewCards = [
    { label: 'Total bookings', value: overviewStats.total, tone: 'bg-primary/10 text-primary' },
    { label: 'Booked', value: overviewStats.booked, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
    { label: 'Confirmed', value: overviewStats.confirmed, tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
    { label: 'In progress', value: overviewStats.inProgress, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    { label: 'Completed', value: overviewStats.completed, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  ];

  const insightItems = [
    { label: 'Today’s schedule', value: `${overviewStats.todayCount} appointment(s)` },
    { label: 'Completion rate', value: `${overviewStats.completionRate}%` },
    { label: 'Needs action', value: `${overviewStats.pendingAction} waiting` },
    { label: 'Cancellations / reschedules', value: `${overviewStats.cancelled + overviewStats.rescheduled}` },
  ];

  const groupedRows = useMemo(() => {
    const groups: Record<string, any[]> = {};
    STATUS_GROUP_ORDER.forEach((status) => {
      groups[status] = [];
    });

    orderedRows.forEach((row) => {
      const key = String(row.status || 'booked');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });

    return groups;
  }, [orderedRows]);

  const updateProgress = async (id: string) => {
    const draft = progressDraft[id];
    if (!draft?.progress_step) {
      toast({ title: 'Progress step is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await updateServiceProgress(id, {
        status: draft.status || undefined,
        progress_step: draft.progress_step,
        payment_status: draft.payment_status || undefined,
        assigned_service_expert_profile_id: draft.assigned_service_expert_profile_id || null,
        note: draft.note || undefined,
      });
      toast({ title: 'Service progress updated' });
      await loadRows();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void loadRows()} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {overviewCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-2xl font-heading font-bold text-foreground">{card.value}</span>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${card.tone}`}>
                  {String(card.value).slice(0, 2) || '0'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          {insightItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-lg font-heading font-bold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        {orderedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service appointments found for current scope.</p>
        ) : (
          STATUS_GROUP_ORDER.filter((status) => statusFilter === 'all' ? groupedRows[status]?.length : status === statusFilter).map((status) => {
            const groupRows = groupedRows[status] || [];
            if (!groupRows.length) return null;

            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{status.replace(/_/g, ' ')}</p>
                  <Badge variant="outline">{groupRows.length}</Badge>
                </div>

                <div className="space-y-3">
                  {groupRows.map((row) => {
                    const draft = progressDraft[row.id] || {
                      status: row.status || 'booked',
                      progress_step: row.progress_step || row.status || 'booked',
                      payment_status: row.payment_status || 'pending',
                      assigned_service_expert_profile_id: row.assigned_service_expert_profile_id || '',
                      note: '',
                    };

                    return (
                      <div key={row.id} className="rounded-lg border border-border p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{row.appointment_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.customer_name} | {row.vehicle?.registration_number || '-'} | {row.appointment_date} {row.appointment_time}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{String(row.status || '').replace(/_/g, ' ')}</Badge>
                            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{String(row.progress_step || '').replace(/_/g, ' ')}</Badge>
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Payment: {String(row.payment_status || 'pending')}</Badge>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-5">
                          <div className="grid gap-1">
                            <Label className="text-xs">Status</Label>
                            <Select
                              value={draft.status}
                              onValueChange={(value) => setProgressDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, status: value },
                              }))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((statusOption) => (
                                  <SelectItem key={statusOption} value={statusOption}>{statusOption.replace(/_/g, ' ')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">Progress Step</Label>
                            <Input
                              className="h-8 text-xs"
                              value={draft.progress_step}
                              onChange={(e) => setProgressDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, progress_step: e.target.value },
                              }))}
                              placeholder="in_progress"
                            />
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">Payment</Label>
                            <Select
                              value={draft.payment_status}
                              onValueChange={(value) => setProgressDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, payment_status: value },
                              }))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUS_OPTIONS.map((statusOption) => (
                                  <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">Assigned Expert</Label>
                            <Select
                              value={draft.assigned_service_expert_profile_id || '__unassigned__'}
                              onValueChange={(value) => setProgressDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, assigned_service_expert_profile_id: value === '__unassigned__' ? '' : value },
                              }))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                {serviceExperts.map((expert) => (
                                  <SelectItem key={expert.id} value={expert.id}>{expert.full_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">Note (optional)</Label>
                            <Input
                              className="h-8 text-xs"
                              value={draft.note}
                              onChange={(e) => setProgressDraft((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, note: e.target.value },
                              }))}
                              placeholder="Quick update note"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button size="sm" className="h-8 text-xs" onClick={() => void updateProgress(row.id)} disabled={loading}>
                            Update Progress
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
