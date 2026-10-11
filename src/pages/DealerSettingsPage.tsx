import DashboardLayout from '@/components/DashboardLayout';
import DealerProfileSettings from '@/components/settings/DealerProfileSettings';
import BrandSettings from '@/components/settings/BrandSettings';
import OperatingHoursSettings from '@/components/settings/OperatingHoursSettings';
import ReportSettingsConfig from '@/components/settings/ReportSettingsConfig';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import FollowUpReminderSettings from '@/components/settings/FollowUpReminderSettings';
import TimesheetReminderSettings from '@/components/settings/TimesheetReminderSettings';
import HandoverQuestionsSettings from '@/components/settings/HandoverQuestionsSettings';
import BookingSettings from '@/components/settings/BookingSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import EmailTemplateSettings from '@/components/settings/EmailTemplateSettings';
import HierarchySettings from '@/components/settings/HierarchySettings';
import DealOptionsSettings from '@/components/settings/DealOptionsSettings';
import CarBookingPaymentSettings from '@/components/settings/CarBookingPaymentSettings';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Building2, Palette, Mail, SunMoon, BellRing, Key, CalendarClock, Plug, GitBranch, ChevronDown, Clock3, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { useEffect, useMemo, useState } from 'react';
import { apiDbQuery, apiGet, apiPost } from '@/lib/apiClient';

const DealerSettingsPage = () => {
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const showEmailTemplates = isSuperAdmin || role === APP_ROLE.DEALER_ADMIN;

  const [allDealers, setAllDealers] = useState<{ id: string; name: string }[]>([]);
  const [selectedDealer, setSelectedDealer] = useState('');
  const [subscriptionSummary, setSubscriptionSummary] = useState<{ package_name: string; billing_period: 'monthly' | 'yearly' } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingRequestsLoading, setPendingRequestsLoading] = useState(false);
  const [requestActionLoadingId, setRequestActionLoadingId] = useState<string | null>(null);
  const [subscriptionLogs, setSubscriptionLogs] = useState<any[]>([]);
  const [subscriptionLogsLoading, setSubscriptionLogsLoading] = useState(false);
  const [runningReminderJob, setRunningReminderJob] = useState(false);
  const [reminderJobMessage, setReminderJobMessage] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiDbQuery<any[]>({
      table: 'dealers',
      action: 'select',
      select: 'id, name',
      order: [{ field: 'name', ascending: true }],
    }).then((d) => {
      const rows = (d ?? []).map((x: any) => ({ id: x.id, name: x.name }));
      setAllDealers(rows);

      if (typeof window !== 'undefined') {
        const dealerIdFromQuery = new URLSearchParams(window.location.search).get('dealerId') || '';
        if (dealerIdFromQuery && rows.some((r) => r.id === dealerIdFromQuery)) {
          setSelectedDealer(dealerIdFromQuery);
        }
      }
    });
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedDealer) {
      setSubscriptionSummary(null);
      return;
    }

    let cancelled = false;
    setSubscriptionLoading(true);
    apiGet<any>(`/api/dealers/${selectedDealer}/subscription`)
      .then((data) => {
        if (cancelled) return;
        setSubscriptionSummary({
          package_name: data?.package_name || 'Free Package',
          billing_period: data?.billing_period === 'yearly' ? 'yearly' : 'monthly',
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSubscriptionSummary(null);
      })
      .finally(() => {
        if (cancelled) return;
        setSubscriptionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, selectedDealer]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedDealer) {
      setPendingRequests([]);
      return;
    }

    let cancelled = false;
    setPendingRequestsLoading(true);
    apiGet<any[]>(`/api/subscription-requests?dealer_id=${selectedDealer}&status=pending`)
      .then((rows) => {
        if (cancelled) return;
        setPendingRequests(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (cancelled) return;
        setPendingRequests([]);
      })
      .finally(() => {
        if (cancelled) return;
        setPendingRequestsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, selectedDealer]);

  useEffect(() => {
    if (!isSuperAdmin || !selectedDealer) {
      setSubscriptionLogs([]);
      return;
    }

    let cancelled = false;
    setSubscriptionLogsLoading(true);
    apiGet<any[]>(`/api/subscription-requests?dealer_id=${selectedDealer}`)
      .then((rows) => {
        if (cancelled) return;
        setSubscriptionLogs(Array.isArray(rows) ? rows.slice(0, 12) : []);
      })
      .catch(() => {
        if (cancelled) return;
        setSubscriptionLogs([]);
      })
      .finally(() => {
        if (cancelled) return;
        setSubscriptionLogsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, selectedDealer]);

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    setRequestActionLoadingId(requestId);
    try {
      await apiPost(`/api/subscription-requests/${requestId}/${action}`, {});
      const [latestSubscription, latestRequests] = await Promise.all([
        apiGet<any>(`/api/dealers/${selectedDealer}/subscription`),
        apiGet<any[]>(`/api/subscription-requests?dealer_id=${selectedDealer}&status=pending`),
      ]);
      const latestLogs = await apiGet<any[]>(`/api/subscription-requests?dealer_id=${selectedDealer}`);
      setSubscriptionSummary({
        package_name: latestSubscription?.package_name || 'Free Package',
        billing_period: latestSubscription?.billing_period === 'yearly' ? 'yearly' : 'monthly',
      });
      setPendingRequests(Array.isArray(latestRequests) ? latestRequests : []);
      setSubscriptionLogs(Array.isArray(latestLogs) ? latestLogs.slice(0, 12) : []);
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  const runReminderJobsNow = async () => {
    setRunningReminderJob(true);
    setReminderJobMessage('');
    try {
      const result = await apiPost<any>('/api/subscriptions/reminders/run-now', {});
      const soon = Number(result?.expiringSoonProcessed || 0);
      const expired = Number(result?.expiredProcessed || 0);
      setReminderJobMessage(`Reminder jobs completed. Expiring soon emails: ${soon}, expired processed: ${expired}.`);
    } catch (error: any) {
      setReminderJobMessage(error?.message || 'Failed to run reminder jobs.');
    } finally {
      setRunningReminderJob(false);
    }
  };

  const dealerOverride = isSuperAdmin ? selectedDealer || undefined : undefined;
  const [selectedSection, setSelectedSection] = useState('profile');

  const settingMenuItems = useMemo(() => [
    { key: 'profile', label: 'Dealership Profile', icon: Building2, content: <DealerProfileSettings dealerIdOverride={dealerOverride} /> },
    { key: 'brands', label: 'Brand Settings', icon: Palette, content: <BrandSettings dealerIdOverride={dealerOverride} /> },
    { key: 'reports', label: 'Report Settings', icon: Mail, content: <ReportSettingsConfig /> },
    { key: 'followup-reminders', label: 'Follow-up Reminders', icon: BellRing, content: <FollowUpReminderSettings /> },
    { key: 'timesheet-reminders', label: 'Timesheet Reminders', icon: Clock3, content: <TimesheetReminderSettings dealerIdOverride={dealerOverride} /> },
    { key: 'appearance', label: 'Appearance', icon: SunMoon, content: <AppearanceSettings /> },
    { key: 'handover', label: 'Key Handover', icon: Key, content: <HandoverQuestionsSettings /> },
    { key: 'booking', label: 'Booking', icon: CalendarClock, content: <BookingSettings dealerIdOverride={dealerOverride} /> },
    { key: 'car-booking-payment', label: 'Car Booking Payments', icon: CreditCard, content: <CarBookingPaymentSettings /> },
    { key: 'deal-options', label: 'Deal Options', icon: GitBranch, content: <DealOptionsSettings dealerIdOverride={dealerOverride} /> },
    { key: 'integrations', label: 'Integrations', icon: Plug, content: <IntegrationSettings /> },
    { key: 'hierarchy', label: 'Entity Hierarchy', icon: GitBranch, content: <HierarchySettings /> },
    ...(showEmailTemplates ? [{ key: 'email-templates', label: 'Email Templates', icon: Mail, content: <EmailTemplateSettings /> }] : []),
    { key: 'hours', label: 'Operating Hours', icon: CalendarClock, content: <OperatingHoursSettings dealerIdOverride={dealerOverride} /> },
  ], [dealerOverride, showEmailTemplates]);

  const selectedMenuItem = settingMenuItems.find((item) => item.key === selectedSection) ?? settingMenuItems[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your dealership profile and brand settings</p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2 min-w-0">
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="h-9 px-3 border border-input rounded-md text-sm bg-background min-w-[200px]"
                value={selectedDealer}
                onChange={e => setSelectedDealer(e.target.value)}
              >
                <option value="">— Select a Dealer —</option>
                {allDealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {isSuperAdmin ? (
          <Card className="border border-border/70 bg-background/80">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subscription overview</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{selectedDealer ? 'Active plan details' : 'Select a dealer to view subscription details'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedDealer
                    ? 'See the current package and billing period at a glance.'
                    : 'Choose a dealer from the dropdown above to load its subscription record.'}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={runReminderJobsNow}
                    disabled={runningReminderJob}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground disabled:opacity-60"
                  >
                    {runningReminderJob ? 'Running reminders…' : 'Run Expiry Reminder Now'}
                  </button>
                </div>
                {reminderJobMessage ? (
                  <p className="mt-2 text-xs text-muted-foreground">{reminderJobMessage}</p>
                ) : null}
              </div>
              <div className="grid min-w-[240px] gap-2 rounded-2xl border border-border bg-muted/30 p-3 sm:text-right">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Package</p>
                  <p className="text-sm font-semibold text-foreground">
                    {subscriptionLoading ? 'Loading…' : subscriptionSummary?.package_name || 'Free Package'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Billing</p>
                  <p className="text-sm font-semibold text-foreground">
                    {subscriptionLoading
                      ? 'Loading…'
                      : subscriptionSummary?.billing_period === 'yearly' ? 'Yearly' : 'Monthly'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isSuperAdmin && selectedDealer ? (
          <Card className="border border-border/70 bg-background/80">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pending subscription requests</p>
                <p className="mt-1 text-sm text-muted-foreground">Approve or reject package/billing change requests from brand and branch admins.</p>
              </div>
              {pendingRequestsLoading ? (
                <p className="text-sm text-muted-foreground">Loading requests…</p>
              ) : pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-medium text-foreground">
                        {request.current_package_name} ({request.current_billing_period}) → {request.requested_package_name} ({request.requested_billing_period})
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested by {request.requested_by_email || request.requested_by_role || 'staff'}
                      </p>
                      {request.note ? <p className="text-xs text-muted-foreground mt-1">Note: {request.note}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
                          disabled={requestActionLoadingId === request.id}
                          onClick={() => handleRequestAction(request.id, 'approve')}
                        >
                          {requestActionLoadingId === request.id ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground disabled:opacity-60"
                          disabled={requestActionLoadingId === request.id}
                          onClick={() => handleRequestAction(request.id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {isSuperAdmin && selectedDealer ? (
          <Card className="border border-border/70 bg-background/80">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subscription logs</p>
                <p className="mt-1 text-sm text-muted-foreground">Requester and reviewer email trail for subscription plan changes.</p>
              </div>
              {subscriptionLogsLoading ? (
                <p className="text-sm text-muted-foreground">Loading logs…</p>
              ) : subscriptionLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscription logs yet.</p>
              ) : (
                <div className="space-y-2">
                  {subscriptionLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-border p-3 text-xs">
                      <p className="text-sm font-medium text-foreground">
                        {log.requested_package_name} ({log.requested_billing_period})
                      </p>
                      <p className="mt-1 text-muted-foreground">Status: {log.status}</p>
                      <p className="text-muted-foreground">Requested by: {log.requested_by_email || log.requested_by_role || 'N/A'}</p>
                      <p className="text-muted-foreground">Reviewed by: {log.reviewed_by_email || 'Pending'}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {isSuperAdmin && !selectedDealer ? (
          <div className="text-xs text-muted-foreground px-1">Showing data for all dealers. Select a dealer above to scope to one.</div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <Card className="border border-border bg-background">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Settings menu</p>
                <h2 className="text-lg font-semibold text-foreground mt-1">Choose a section</h2>
              </div>
              <div className="space-y-1">
                {settingMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === selectedSection;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedSection(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted dark:hover:bg-slate-800',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedMenuItem.content}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DealerSettingsPage;
