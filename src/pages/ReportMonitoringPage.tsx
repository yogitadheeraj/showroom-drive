import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Mail, RotateCcw, Send } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useDealerContext } from '@/hooks/useDealerContext';

interface SendAttempt {
  id: string;
  location_id: string;
  report_type: string;
  recipient_email: string;
  report_date: string;
  attempt_number: number;
  status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  error_code: string | null;
  sent_at: string | null;
  next_retry_at: string | null;
  superadmin_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportSchedule {
  id: string;
  location_id: string;
  report_type: 'test_drive_daily' | 'activity_daily';
  schedule_time: string;
  days_of_week: string[];
  timezone: string;
  is_enabled: boolean;
}

const ReportMonitoringDashboard = () => {
  const { dealerLocationIds } = useDealerContext();
  const [attempts, setAttempts] = useState<SendAttempt[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [filterEmail, setFilterEmail] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [sendingNow, setSendingNow] = useState<string | null>(null);

  useEffect(() => {
    if (dealerLocationIds && dealerLocationIds.length > 0) {
      fetchAttempts();
      fetchSchedules();
    }
  }, [dealerLocationIds]);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('report_send_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (dealerLocationIds && dealerLocationIds.length > 0) {
        query = query.in('location_id', dealerLocationIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAttempts((data || []) as unknown as SendAttempt[]);
    } catch (error) {
      console.error('Error fetching attempts:', error);
      toast.error('Failed to load report monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    if (!dealerLocationIds || dealerLocationIds.length === 0) return;

    try {
      setScheduleLoading(true);

      const [scheduleRes, locationRes] = await Promise.all([
        supabase
          .from('report_schedule_config')
          .select('id, location_id, report_type, schedule_time, days_of_week, timezone, is_enabled')
          .in('location_id', dealerLocationIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('locations')
          .select('id, name')
          .in('id', dealerLocationIds),
      ]);

      if (scheduleRes.error) throw scheduleRes.error;
      if (locationRes.error) throw locationRes.error;

      const names: Record<string, string> = {};
      (locationRes.data || []).forEach((loc) => {
        names[loc.id] = loc.name;
      });

      setSchedules((scheduleRes.data || []) as ReportSchedule[]);
      setLocationNames(names);
    } catch (error) {
      console.error('Error fetching report schedules:', error);
      toast.error('Failed to load report schedules');
    } finally {
      setScheduleLoading(false);
    }
  };

  const sendScheduleNow = async (schedule: ReportSchedule) => {
    try {
      setSendingNow(schedule.id);
      const today = new Date().toISOString().split('T')[0];

      const functionName =
        schedule.report_type === 'test_drive_daily'
          ? 'send-daily-test-drive-reports'
          : 'send-daily-activity-reports';

      const { error } = await supabase.functions.invoke(functionName, {
        body: {
          reportDate: today,
          locationIds: [schedule.location_id],
        },
      });

      if (error) throw error;

      toast.success('Report sent immediately');
      setTimeout(() => fetchAttempts(), 1000);
    } catch (error) {
      console.error('Error sending report immediately:', error);
      toast.error('Failed to send report immediately');
    } finally {
      setSendingNow(null);
    }
  };

  const retryFailedReport = async (attemptId: string) => {
    try {
      setRetrying(attemptId);
      const attempt = attempts.find((a) => a.id === attemptId);
      if (!attempt) return;

      // Call handle-report-retry edge function
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-report-retry`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            locationId: attempt.location_id,
            reportType: attempt.report_type,
            recipientEmail: attempt.recipient_email,
            reportDate: attempt.report_date,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retry failed: ${errorText}`);
      }

      toast.success('Retry triggered successfully');
      // Refresh data after a short delay to let the function complete
      setTimeout(() => fetchAttempts(), 1000);
    } catch (error) {
      console.error('Error retrying report:', error);
      toast.error('Failed to retry report send');
    } finally {
      setRetrying(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-success/10 text-success';
      case 'failed':
        return 'bg-destructive/10 text-destructive';
      case 'pending':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const filteredAttempts = attempts.filter((attempt) => {
    if (filterStatus !== 'all' && attempt.status !== filterStatus) return false;
    if (filterEmail && !attempt.recipient_email.toLowerCase().includes(filterEmail.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: attempts.length,
    success: attempts.filter((a) => a.status === 'success').length,
    failed: attempts.filter((a) => a.status === 'failed').length,
    pending: attempts.filter((a) => a.status === 'pending').length,
    needsRetry: attempts.filter((a) => a.status === 'failed' && a.attempt_number < 3).length,
    superadminAlerts: attempts.filter((a) => a.superadmin_notified_at).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Report Delivery Monitor</h1>
            <p className="text-sm text-muted-foreground mt-1">Track all sent reports and manage retries</p>
          </div>
          <Button onClick={fetchAttempts} variant="outline" className="gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Sent</p>
              <p className="text-2xl font-bold mt-2">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-success font-medium uppercase">✓ Success</p>
              <p className="text-2xl font-bold mt-2 text-success">{stats.success}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-destructive font-medium uppercase">✗ Failed</p>
              <p className="text-2xl font-bold mt-2 text-destructive">{stats.failed}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-warning font-medium uppercase">⏱ Pending</p>
              <p className="text-2xl font-bold mt-2 text-warning">{stats.pending}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-orange-600 font-medium uppercase">Retry Ready</p>
              <p className="text-2xl font-bold mt-2 text-orange-600">{stats.needsRetry}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-red-600 font-medium uppercase">Admin Alert</p>
              <p className="text-2xl font-bold mt-2 text-red-600">{stats.superadminAlerts}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                  <option value="pending">Pending Only</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="text"
                  placeholder="Filter by email..."
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterEmail('');
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All Report Schedules */}
        <Card>
          <CardHeader>
            <CardTitle>All Report Schedules</CardTitle>
            <CardDescription>View schedules for all dealer locations and send any report immediately</CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleLoading ? (
              <div className="text-center py-8">Loading schedules...</div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No report schedules found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/70 bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Location</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Time</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Days</th>
                      <th className="text-center py-3 px-4 font-medium text-foreground">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr key={schedule.id} className="border-b border-border/40 hover:bg-muted/25 transition">
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium">
                            {locationNames[schedule.location_id] || schedule.location_id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {schedule.report_type === 'test_drive_daily' ? 'Test Drive' : 'Activity'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-muted-foreground">
                            {schedule.schedule_time} ({schedule.timezone})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-muted-foreground">
                            {schedule.days_of_week?.join(', ') || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={schedule.is_enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                            {schedule.is_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendScheduleNow(schedule)}
                            disabled={sendingNow === schedule.id}
                            className="gap-1"
                          >
                            <Send className={`h-3 w-3 ${sendingNow === schedule.id ? 'animate-pulse' : ''}`} />
                            {sendingNow === schedule.id ? 'Sending...' : 'Send Now'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Grid/Table */}
        <Card>
          <CardHeader>
            <CardTitle>Send Attempts ({filteredAttempts.length})</CardTitle>
            <CardDescription>All report delivery attempts with retry options</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading report attempts...</div>
            ) : filteredAttempts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No report attempts found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/70 bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Email</th>
                      <th className="text-center py-3 px-4 font-medium text-foreground">Attempt</th>
                      <th className="text-center py-3 px-4 font-medium text-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Sent At</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Next Retry</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Error</th>
                      <th className="text-center py-3 px-4 font-medium text-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((attempt) => (
                      <tr key={attempt.id} className="border-b border-border/40 hover:bg-muted/25 transition">
                        <td className="py-3 px-4">
                          <span className="text-xs font-mono">{attempt.report_date}</span>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {attempt.report_type === 'test_drive_daily' ? '📊 Test Drive' : '📋 Activity'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{attempt.recipient_email}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="text-xs font-medium">{attempt.attempt_number}/3</span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Badge className={`text-xs gap-2 justify-center ${getStatusColor(attempt.status)}`}>
                            {getStatusIcon(attempt.status)}
                            {attempt.status.charAt(0).toUpperCase() + attempt.status.slice(1)}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          {attempt.sent_at ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(attempt.sent_at).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {attempt.next_retry_at ? (
                            <span className={`text-xs font-medium ${new Date(attempt.next_retry_at) <= new Date() ? 'text-orange-600' : 'text-muted-foreground'}`}>
                              {new Date(attempt.next_retry_at).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {attempt.error_message ? (
                            <span className="text-xs text-destructive cursor-help" title={attempt.error_message}>
                              {attempt.error_message.substring(0, 30)}...
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {attempt.status === 'failed' && attempt.attempt_number < 3 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryFailedReport(attempt.id)}
                              disabled={retrying === attempt.id}
                              className="gap-1"
                            >
                              <RotateCcw className={`h-3 w-3 ${retrying === attempt.id ? 'animate-spin' : ''}`} />
                              {retrying === attempt.id ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}
                          {attempt.superadmin_notified_at && (
                            <Badge variant="secondary" className="text-xs bg-red-50 text-red-600">
                              Alert Sent
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900">📌 How Retry Works</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Failed reports automatically retry: 1st attempt after 5 mins, 2nd after 15 mins, 3rd after 1 hour</li>
                <li>After 3 failed attempts, superadmin receives alert email</li>
                <li>You can manually retry any failed report before automatic retry time</li>
                <li>Click "Retry" button to trigger immediate resend</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ReportMonitoringDashboard;
