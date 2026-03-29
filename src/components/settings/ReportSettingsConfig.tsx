import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Clock, Mail } from 'lucide-react';
import { useDealerContext } from '@/hooks/useDealerContext';

interface EmailConfig {
  id: string;
  email_address: string;
  report_type: 'test_drive_daily' | 'activity_daily' | 'both';
  is_enabled: boolean;
}

interface ScheduleConfig {
  id: string;
  report_type: 'test_drive_daily' | 'activity_daily';
  schedule_time: string;
  days_of_week: string[];
  is_enabled: boolean;
  timezone: string;
}

const DAYS_OF_WEEK = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
];

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Singapore',
  'UTC',
  'Europe/London',
];

const ReportSettingsConfig = () => {
  const { userData } = useDealerContext();
  const [emailConfigs, setEmailConfigs] = useState<EmailConfig[]>([]);
  const [scheduleConfigs, setScheduleConfigs] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailReportType, setNewEmailReportType] = useState<'test_drive_daily' | 'activity_daily' | 'both'>('both');
  const [newScheduleTime, setNewScheduleTime] = useState('09:00');
  const [newScheduleReportType, setNewScheduleReportType] = useState<'test_drive_daily' | 'activity_daily'>('test_drive_daily');
  const [newScheduleDays, setNewScheduleDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [newScheduleTimezone, setNewScheduleTimezone] = useState('Asia/Kolkata');

  const locationId = userData?.location_id;

  useEffect(() => {
    if (locationId) {
      fetchConfigs();
    }
  }, [locationId]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const [emailRes, scheduleRes] = await Promise.all([
        supabase
          .from('report_email_config')
          .select('*')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false }),
        supabase
          .from('report_schedule_config')
          .select('*')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false }),
      ]);

      if (emailRes.data) setEmailConfigs(emailRes.data);
      if (scheduleRes.data) setScheduleConfigs(scheduleRes.data);
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const addEmailConfig = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter at least one email address');
      return;
    }

    try {
      const parsedEmails = Array.from(
        new Set(
          newEmail
            .split(/[\n,;]+/)
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
        )
      );

      if (parsedEmails.length === 0) {
        toast.error('Please enter valid email addresses');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = parsedEmails.filter((email) => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        toast.error(`Invalid email: ${invalidEmails[0]}`);
        return;
      }

      const payload = parsedEmails.map((email) => ({
        location_id: locationId,
        email_address: email,
        report_type: newEmailReportType,
        is_enabled: true,
      }));

      const { error } = await supabase.from('report_email_config').upsert(payload, { onConflict: 'location_id,email_address,report_type', ignoreDuplicates: true });

      if (error) throw error;

      toast.success(`${parsedEmails.length} email recipient${parsedEmails.length > 1 ? 's' : ''} added successfully`);
      setNewEmail('');
      fetchConfigs();
    } catch (error: any) {
      console.error('Error adding email config:', error);
      toast.error('Failed to add email configuration');
    }
  };

  const deleteEmailConfig = async (id: string) => {
    try {
      const { error } = await supabase.from('report_email_config').delete().eq('id', id);

      if (error) throw error;

      toast.success('Email configuration removed');
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting email config:', error);
      toast.error('Failed to remove configuration');
    }
  };

  const toggleEmailConfig = async (id: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('report_email_config')
        .update({ is_enabled: !isEnabled })
        .eq('id', id);

      if (error) throw error;

      toast.success(isEnabled ? 'Configuration disabled' : 'Configuration enabled');
      fetchConfigs();
    } catch (error) {
      console.error('Error toggling email config:', error);
      toast.error('Failed to update configuration');
    }
  };

  const addScheduleConfig = async () => {
    if (newScheduleDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    try {
      const existingSchedule = scheduleConfigs.find((s) => s.report_type === newScheduleReportType);

      if (existingSchedule) {
        // Update existing schedule
        const { error } = await supabase
          .from('report_schedule_config')
          .update({
            schedule_time: newScheduleTime,
            days_of_week: newScheduleDays,
            timezone: newScheduleTimezone,
          })
          .eq('id', existingSchedule.id);

        if (error) throw error;

        toast.success('Schedule updated successfully');
      } else {
        // Insert new schedule
        const { error } = await supabase.from('report_schedule_config').insert({
          location_id: locationId,
          report_type: newScheduleReportType,
          schedule_time: newScheduleTime,
          days_of_week: newScheduleDays,
          timezone: newScheduleTimezone,
          is_enabled: true,
        });

        if (error) throw error;

        toast.success('Schedule created successfully');
      }

      fetchConfigs();
    } catch (error) {
      console.error('Error managing schedule config:', error);
      toast.error('Failed to save schedule');
    }
  };

  const toggleScheduleConfig = async (id: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('report_schedule_config')
        .update({ is_enabled: !isEnabled })
        .eq('id', id);

      if (error) throw error;

      toast.success(isEnabled ? 'Schedule disabled' : 'Schedule enabled');
      fetchConfigs();
    } catch (error) {
      console.error('Error toggling schedule config:', error);
      toast.error('Failed to update schedule');
    }
  };

  const deleteScheduleConfig = async (id: string) => {
    try {
      const { error } = await supabase.from('report_schedule_config').delete().eq('id', id);

      if (error) throw error;

      toast.success('Schedule removed');
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting schedule config:', error);
      toast.error('Failed to remove schedule');
    }
  };

 
  return (
    <div className="space-y-6">
      {/* Email Recipients Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Recipients
          </CardTitle>
          <CardDescription>Configure email addresses to receive daily reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Email Form */}
          <div className="border border-border/70 rounded-2xl p-4 bg-muted/25">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Email Address(es)</label>
                <Input
                  type="text"
                  placeholder="admin@dealership.com, sales@dealership.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">Use comma, semicolon, or new line to add multiple recipients at once.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Report Type</label>
                  <select
                    value={newEmailReportType}
                    onChange={(e) => setNewEmailReportType(e.target.value as any)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                  >
                    <option value="test_drive_daily">Test Drive Reports Only</option>
                    <option value="activity_daily">Activity Reports Only</option>
                    <option value="both">Both Reports</option>
                  </select>
                </div>
              </div>

              <Button onClick={addEmailConfig} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Email Recipient
              </Button>
            </div>
          </div>

          {/* Email List */}
          <div className="space-y-2">
            {emailConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No email recipients configured yet</p>
            ) : (
              emailConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 border border-border/70 rounded-lg bg-card/50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{config.email_address}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {config.report_type === 'both' ? 'Both Reports' : config.report_type === 'test_drive_daily' ? 'Test Drive' : 'Activity'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleEmailConfig(config.id, config.is_enabled)}
                      className={`p-2 rounded transition-colors ${
                        config.is_enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Switch className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteEmailConfig(config.id)}
                      className="p-2 rounded hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Report Schedule
          </CardTitle>
          <CardDescription>Configure when reports should be sent automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Schedule Form */}
          <div className="border border-border/70 rounded-2xl p-4 bg-muted/25">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Report Type</label>
                  <select
                    value={newScheduleReportType}
                    onChange={(e) => setNewScheduleReportType(e.target.value as any)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                  >
                    <option value="test_drive_daily">Test Drive Report</option>
                    <option value="activity_daily">Activity Report</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Send Time (IST)</label>
                  <Input
                    type="time"
                    value={newScheduleTime}
                    onChange={(e) => setNewScheduleTime(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Timezone</label>
                  <select
                    value={newScheduleTimezone}
                    onChange={(e) => setNewScheduleTimezone(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Days of Week</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newScheduleDays.includes(day.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewScheduleDays([...newScheduleDays, day.value]);
                          } else {
                            setNewScheduleDays(newScheduleDays.filter((d) => d !== day.value));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={addScheduleConfig} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Save Schedule
              </Button>
            </div>
          </div>

          {/* Schedule List */}
          <div className="space-y-2">
            {scheduleConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No schedules configured yet</p>
            ) : (
              scheduleConfigs.map((config) => (
                <div
                  key={config.id}
                  className="p-3 border border-border/70 rounded-lg bg-card/50 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {config.report_type === 'test_drive_daily' ? '📊 Test Drive Report' : '📋 Activity Report'}
                        </Badge>
                        <Badge className="bg-primary/10 text-primary">{config.schedule_time}</Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Days: <span className="font-medium">{config.days_of_week.join(', ').charAt(0).toUpperCase() + config.days_of_week.join(', ').slice(1)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Timezone: <span className="font-medium">{config.timezone}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleScheduleConfig(config.id, config.is_enabled)}
                        className={`p-2 rounded transition-colors ${
                          config.is_enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Switch className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteScheduleConfig(config.id)}
                        className="p-2 rounded hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-blue-900">📌 How It Works</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Add email addresses of all staff who should receive reports</li>
              <li>Select which report types each email should receive (Test Drive, Activity, or Both)</li>
              <li>Configure automatic sending schedule with time and days preference</li>
              <li>Reports will be sent automatically as per the configured schedule</li>
              <li>Use the toggle to enable/disable any configuration temporarily</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportSettingsConfig;
