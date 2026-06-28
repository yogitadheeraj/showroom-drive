import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { APP_ROLE } from '@/constants/roles';
import {
  getFollowUpReminderConfig,
  upsertFollowUpReminderConfig,
  type FollowUpReminderConfig,
} from '@/lib/followUpReminderConfigService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BellRing } from 'lucide-react';

const DEFAULT_CONFIG: Omit<FollowUpReminderConfig, 'id' | 'location_id' | 'dealer_id' | 'updated_by_profile_id' | 'created_at' | 'updated_at'> = {
  reminder_enabled: true,
  reminder_before_minutes: 30,
  reminder_message: 'Follow-up due soon: {{title}} at {{dueAt}}',
  tone_type: 'classic',
  notify_due_list: true,
};

const TONE_OPTIONS = [
  { value: 'classic', label: 'Classic Beep' },
  { value: 'soft', label: 'Soft Chime' },
  { value: 'alert', label: 'Alert Tone' },
];

const FollowUpReminderSettings = () => {
  const { role, profile } = useAuth();
  const { dealerId, dealerLocationIds } = useDealerContext();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FollowUpReminderConfig | null>(null);

  const isAllowedRole = role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN;
  const locationId = profile?.location_id || (dealerLocationIds && dealerLocationIds[0]) || null;

  useEffect(() => {
    if (!isAllowedRole || !locationId) {
      setLoading(false);
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const row = await getFollowUpReminderConfig(locationId);
        setForm(
          row ?? {
            ...DEFAULT_CONFIG,
            id: '',
            location_id: locationId,
            dealer_id: null,
            updated_by_profile_id: null,
            created_at: '',
            updated_at: '',
          },
        );
      } catch {
        // No saved config yet — use defaults
        setForm({
          ...DEFAULT_CONFIG,
          id: '',
          location_id: locationId,
          dealer_id: null,
          updated_by_profile_id: null,
          created_at: '',
          updated_at: '',
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchConfig();
  }, [isAllowedRole, locationId, toast]);

  const handleSave = async () => {
    if (!locationId || !isAllowedRole || !form) return;

    const reminderBefore = Math.max(1, Math.min(120, Number(form.reminder_before_minutes) || 30));
    setSaving(true);
    try {
      const saved = await upsertFollowUpReminderConfig({
        location_id: locationId,
        dealer_id: dealerId ?? null,
        reminder_enabled: form.reminder_enabled,
        reminder_before_minutes: reminderBefore,
        reminder_message: form.reminder_message.trim() || DEFAULT_CONFIG.reminder_message,
        tone_type: form.tone_type,
        notify_due_list: form.notify_due_list,
        updated_by_profile_id: profile?.id ?? null,
      });
      if (saved) setForm(saved);
      toast({ title: 'Reminder settings saved' });
    } catch (error: any) {
      toast({
        title: 'Failed to save reminder settings',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowedRole) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Follow-up Reminders
          </CardTitle>
          <CardDescription>Only Organization Admin and Branch Admin can configure reminder preferences.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Follow-up Reminders
          </CardTitle>
          <CardDescription>Loading reminder settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" /> Follow-up Reminder Configuration
        </CardTitle>
        <CardDescription>
          Configure when and how follow-up reminders are sent before due time. Use {'{{title}}'} and {'{{dueAt}}'} placeholders in message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Enable reminders</Label>
            <p className="text-xs text-muted-foreground">Turn follow-up reminder notifications on or off.</p>
          </div>
          <Switch
            checked={form?.reminder_enabled ?? true}
            onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, reminder_enabled: checked } : prev)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Reminder before (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={form?.reminder_before_minutes ?? 30}
              onChange={(event) =>
                setForm((prev) => prev ? ({
                  ...prev,
                  reminder_before_minutes: Number(event.target.value) || 30,
                }) : prev)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Tune type</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form?.tone_type ?? 'classic'}
              onChange={(event) => setForm((prev) => prev ? { ...prev, tone_type: event.target.value as 'classic' | 'soft' | 'alert' } : prev)}
            >
              {TONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notification message template</Label>
          <Textarea
            value={form?.reminder_message ?? ''}
            onChange={(event) => setForm((prev) => prev ? { ...prev, reminder_message: event.target.value } : prev)}
            placeholder="Follow-up due soon: {{title}} at {{dueAt}}"
            className="min-h-20"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Show due list notification</Label>
            <p className="text-xs text-muted-foreground">Show consolidated list when multiple follow-ups are due soon.</p>
          </div>
          <Switch
            checked={form?.notify_due_list ?? true}
            onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, notify_due_list: checked } : prev)}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !form}>
            {saving ? 'Saving...' : 'Save Reminder Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FollowUpReminderSettings;
