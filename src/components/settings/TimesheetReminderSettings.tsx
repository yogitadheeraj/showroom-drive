import { useEffect, useMemo, useState } from 'react';
import { BellRing, Clock3, Plus, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery } from '@/lib/apiClient';
import {
  createTimesheetTask,
  getTimesheetReminderConfig,
  listTimesheetTasks,
  upsertTimesheetReminderConfig,
  type TimesheetReminderConfig,
  type TimesheetTask,
} from '@/lib/timesheetReminderService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_CONFIG: Omit<TimesheetReminderConfig, 'id' | 'location_id' | 'dealer_id' | 'updated_by_profile_id' | 'created_at' | 'updated_at'> = {
  reminder_enabled: true,
  reminder_offsets_minutes: [30, 15],
  reminder_message: 'Timesheet due in {{minutes}} minutes at {{dueAt}} for {{taskTitle}}.',
  timezone: 'Asia/Kolkata',
  grace_after_due_minutes: 5,
  escalate_to_manager: true,
};

const TimesheetReminderSettings = ({ dealerIdOverride }: { dealerIdOverride?: string } = {}) => {
  const { role, profile } = useAuth();
  const { dealerId, dealerLocationIds } = useDealerContext();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [form, setForm] = useState<TimesheetReminderConfig | null>(null);
  const [tasks, setTasks] = useState<TimesheetTask[]>([]);
  const [taskTitle, setTaskTitle] = useState('Daily Timesheet Submission');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [resolvedDealerLocationId, setResolvedDealerLocationId] = useState<string | null>(null);

  const isAllowedRole = role === APP_ROLE.SUPERADMIN || role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN;
  const activeDealerId = dealerIdOverride || dealerId || null;
  const locationId = profile?.location_id || resolvedDealerLocationId || (!activeDealerId ? (dealerLocationIds && dealerLocationIds[0]) || null : null);

  const offsetInput = useMemo(() => (form?.reminder_offsets_minutes || [30, 15]).join(','), [form?.reminder_offsets_minutes]);
  const [offsetDraft, setOffsetDraft] = useState('30,15');

  useEffect(() => {
    setOffsetDraft(offsetInput);
  }, [offsetInput]);

  useEffect(() => {
    setResolvedDealerLocationId(null);

    if (!isAllowedRole || !locationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        if (role === APP_ROLE.SUPERADMIN && activeDealerId && !profile?.location_id) {
          const locations = await apiDbQuery<any[]>({
            table: 'locations',
            action: 'select',
            select: 'id, name',
            filters: [
              { field: 'dealer_id', op: 'eq', value: activeDealerId },
              { field: 'is_active', op: 'eq', value: true },
            ],
            order: [{ field: 'name', ascending: true }],
            limit: 1,
          }).catch(() => []);

          const firstLocationId = locations?.[0]?.id ? String(locations[0].id) : null;
          setResolvedDealerLocationId(firstLocationId);

          if (!firstLocationId) {
            setForm({
              ...DEFAULT_CONFIG,
              id: '',
              location_id: '',
              dealer_id: activeDealerId,
              updated_by_profile_id: null,
              created_at: '',
              updated_at: '',
            } as TimesheetReminderConfig);
            setTasks([]);
            return;
          }
        }

        const activeLocationId = locationId || resolvedDealerLocationId;
        if (!activeLocationId) return;

        const [cfg, taskRows] = await Promise.all([
          getTimesheetReminderConfig(activeLocationId).catch(() => null),
          listTimesheetTasks({ location_id: activeLocationId, limit: 100 }).catch(() => []),
        ]);

        setForm(
          cfg || {
            ...DEFAULT_CONFIG,
            id: '',
            location_id: activeLocationId,
            dealer_id: activeDealerId,
            updated_by_profile_id: null,
            created_at: '',
            updated_at: '',
          },
        );
        setTasks(taskRows || []);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [activeDealerId, isAllowedRole, locationId, profile?.location_id, role, resolvedDealerLocationId]);

  const handleSave = async () => {
    const activeLocationId = form?.location_id || locationId;
    if (!activeLocationId || !isAllowedRole || !form) return;

    const offsets = Array.from(
      new Set(
        offsetDraft
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 240)
          .map((value) => Math.round(value)),
      ),
    ).sort((a, b) => b - a);

    if (!offsets.length) {
      toast({ title: 'Invalid offsets', description: 'Enter comma-separated minute values like 30,15', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertTimesheetReminderConfig({
        location_id: activeLocationId,
        dealer_id: activeDealerId,
        reminder_enabled: form.reminder_enabled,
        reminder_offsets_minutes: offsets,
        reminder_message: form.reminder_message,
        timezone: form.timezone || 'Asia/Kolkata',
        grace_after_due_minutes: Math.max(0, Math.min(120, Number(form.grace_after_due_minutes) || 5)),
        escalate_to_manager: form.escalate_to_manager,
      });
      setForm(saved);
      toast({ title: 'Timesheet reminder settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save settings', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!locationId || !taskDueAt.trim()) {
      toast({ title: 'Task due time required', variant: 'destructive' });
      return;
    }

    setCreatingTask(true);
    try {
      await createTimesheetTask({
        location_id: form?.location_id || locationId,
        user_id: profile?.user_id,
        task_title: taskTitle,
        due_at: new Date(taskDueAt).toISOString(),
      });

      const refreshed = await listTimesheetTasks({ location_id: form?.location_id || locationId || undefined, limit: 100 });
      setTasks(refreshed || []);
      setTaskDueAt('');
      toast({ title: 'Timesheet task created' });
    } catch (error: any) {
      toast({ title: 'Failed to create task', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setCreatingTask(false);
    }
  };

  if (!isAllowedRole) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Timesheet Reminders
          </CardTitle>
          <CardDescription>Only Super Admin, Organization Admin, and Branch Admin can manage timesheet reminders.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Timesheet Reminders
          </CardTitle>
          <CardDescription>Loading timesheet reminder settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" /> Timesheet Reminder Configuration
        </CardTitle>
        <CardDescription>
          Configure reminder offsets (for example, 30 and 15 minutes) before due time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Enable timesheet reminders</Label>
            <p className="text-xs text-muted-foreground">Enable or disable automatic reminders for pending timesheets.</p>
          </div>
          <Switch
            checked={form.reminder_enabled}
            onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, reminder_enabled: checked } : prev)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Reminder offsets (minutes)</Label>
            <Input
              value={offsetDraft}
              onChange={(event) => setOffsetDraft(event.target.value)}
              placeholder="30,15"
            />
          </div>
          <div className="space-y-2">
            <Label>Grace after due (minutes)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={form.grace_after_due_minutes}
              onChange={(event) =>
                setForm((prev) => prev ? ({
                  ...prev,
                  grace_after_due_minutes: Number(event.target.value) || 0,
                }) : prev)
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Message template</Label>
          <Textarea
            value={form.reminder_message}
            onChange={(event) => setForm((prev) => prev ? { ...prev, reminder_message: event.target.value } : prev)}
            placeholder="Timesheet due in {{minutes}} minutes at {{dueAt}} for {{taskTitle}}."
            className="min-h-20"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Escalate overdue tasks to managers</Label>
            <p className="text-xs text-muted-foreground">Notify branch/org admins when timesheet remains pending after due time.</p>
          </div>
          <Switch
            checked={form.escalate_to_manager}
            onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, escalate_to_manager: checked } : prev)}
          />
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">Quick task creator</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" />
            <Input type="datetime-local" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} />
            <Button onClick={handleCreateTask} loading={creatingTask} loadingText="Creating...">
              <Plus className="h-4 w-4 mr-1" /> Create task
            </Button>
          </div>
          <div className="space-y-2">
            {tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                <div>
                  <p className="font-medium">{task.task_title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(task.due_at).toLocaleString()}</p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide">{task.status}</span>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-xs text-muted-foreground">No tasks created for this location yet.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} loadingText="Saving...">
            <Save className="h-4 w-4 mr-2" /> Save Timesheet Reminder Settings
          </Button>
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />
          Scheduler runs every 5 minutes and sends reminders within each configured offset window.
        </p>
      </CardContent>
    </Card>
  );
};

export default TimesheetReminderSettings;
