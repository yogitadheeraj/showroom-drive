import { randomUUID } from 'node:crypto';
import { TimesheetReminderConfig } from '../models/TimesheetReminderConfig.js';
import { TimesheetTask } from '../models/TimesheetTask.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';
import { UserRole } from '../models/UserRole.js';
import { createNotification } from './notificationService.js';
import { sendPushToUser } from './firebaseService.js';

function toIso(value: unknown) {
  const d = new Date(String(value || ''));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function resolveOffsets(input: unknown): number[] {
  const values = Array.isArray(input) ? input : [];
  const normalized = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 240)
    .map((v) => Math.round(v));

  const unique = Array.from(new Set(normalized));
  unique.sort((a, b) => b - a);
  return unique.length > 0 ? unique : [30, 15];
}

async function getActorContext(userId: string) {
  const [roleDoc, profileDoc] = await Promise.all([
    UserRole.findOne({ user_id: userId }, { role: 1 }).lean(),
    Profile.findOne({ user_id: userId }).lean(),
  ]);

  const role = (roleDoc?.role || '') as string;
  return {
    role,
    profileId: (profileDoc as any)?.id || null,
    locationId: (profileDoc as any)?.location_id || null,
    dealerId: (profileDoc as any)?.dealer_id || null,
  };
}

async function resolveDealerIdForLocation(locationId: string): Promise<string | null> {
  const location = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean();
  return (location as any)?.dealer_id || null;
}

async function ensureManagePermission(userId: string, locationId: string) {
  const actor = await getActorContext(userId);
  if (actor.role === 'superadmin' || actor.role === 'super_admin') return actor;
  if (actor.role === 'sales_admin' && actor.locationId === locationId) return actor;

  if (actor.role === 'dealer_admin') {
    const targetDealerId = await resolveDealerIdForLocation(locationId);
    if (targetDealerId) {
      return actor;
    }
  }

  throw new Error('Forbidden: insufficient role to manage timesheet reminders');
}

function lean(doc: any) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  delete o._id;
  return o;
}

export async function getTimesheetReminderConfig(locationId: string) {
  const doc = await TimesheetReminderConfig.findOne({ location_id: locationId }).lean();
  if (!doc) return null;
  const o = { ...doc } as any;
  delete o._id;
  return o;
}

export async function listTimesheetReminderConfigs(filters: { location_id?: string; dealer_id?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.dealer_id) query.dealer_id = filters.dealer_id;

  const docs = await TimesheetReminderConfig.find(query).sort({ updated_at: -1 }).lean();
  return docs.map((d) => {
    const o = { ...d } as any;
    delete o._id;
    return o;
  });
}

export async function upsertTimesheetReminderConfig(userId: string, data: Record<string, unknown>) {
  const locationId = String(data.location_id || '');
  if (!locationId) throw new Error('location_id is required');

  const actor = await ensureManagePermission(userId, locationId);
  const dealerId = String(data.dealer_id || '') || (await resolveDealerIdForLocation(locationId)) || null;

  const payload = {
    dealer_id: dealerId,
    reminder_enabled: typeof data.reminder_enabled === 'boolean' ? data.reminder_enabled : true,
    reminder_offsets_minutes: resolveOffsets(data.reminder_offsets_minutes),
    reminder_message: String(data.reminder_message || 'Timesheet due in {{minutes}} minutes at {{dueAt}} for {{taskTitle}}.').trim(),
    timezone: String(data.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata',
    grace_after_due_minutes: Math.max(0, Math.min(120, Number(data.grace_after_due_minutes) || 5)),
    escalate_to_manager: typeof data.escalate_to_manager === 'boolean' ? data.escalate_to_manager : true,
    updated_by_profile_id: actor.profileId,
    updated_at: new Date().toISOString(),
  };

  const existing = await TimesheetReminderConfig.findOne({ location_id: locationId });
  if (existing) {
    const updated = await TimesheetReminderConfig.findOneAndUpdate(
      { location_id: locationId },
      { $set: payload },
      { new: true },
    );
    return updated ? lean(updated) : null;
  }

  const doc = new TimesheetReminderConfig({
    id: randomUUID(),
    location_id: locationId,
    created_at: new Date().toISOString(),
    ...payload,
  });

  await doc.save();
  return lean(doc);
}

export async function listTimesheetTasks(filters: {
  location_id?: string;
  status?: string;
  assignee_user_id?: string;
  from_due_at?: string;
  to_due_at?: string;
  limit?: number;
}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.status) query.status = filters.status;
  if (filters.assignee_user_id) query.user_id = filters.assignee_user_id;

  if (filters.from_due_at || filters.to_due_at) {
    query.due_at = {};
    if (filters.from_due_at) (query.due_at as Record<string, unknown>).$gte = filters.from_due_at;
    if (filters.to_due_at) (query.due_at as Record<string, unknown>).$lte = filters.to_due_at;
  }

  const limit = Math.max(1, Math.min(1000, Number(filters.limit) || 200));
  const docs = await TimesheetTask.find(query).sort({ due_at: 1 }).limit(limit).lean();
  return docs.map((d) => {
    const o = { ...d } as any;
    delete o._id;
    return o;
  });
}

export async function createTimesheetTask(userId: string, data: Record<string, unknown>) {
  const locationId = String(data.location_id || '');
  if (!locationId) throw new Error('location_id is required');
  await ensureManagePermission(userId, locationId);

  const assigneeUserId = String(data.user_id || '');
  if (!assigneeUserId) throw new Error('user_id is required');

  const dueAt = toIso(data.due_at);
  if (!dueAt) throw new Error('due_at must be a valid datetime');

  const profile = await Profile.findOne({ user_id: assigneeUserId }, { id: 1, location_id: 1, dealer_id: 1 }).lean();
  const dealerId = (profile as any)?.dealer_id || (await resolveDealerIdForLocation(locationId));

  const actor = await getActorContext(userId);

  const doc = new TimesheetTask({
    id: randomUUID(),
    user_id: assigneeUserId,
    profile_id: (profile as any)?.id || null,
    location_id: locationId,
    dealer_id: dealerId || null,
    task_title: String(data.task_title || 'Daily Timesheet Submission').trim() || 'Daily Timesheet Submission',
    due_at: dueAt,
    status: 'pending',
    submitted_at: null,
    sent_offsets: [],
    last_reminder_at: null,
    escalated_at: null,
    metadata: (data.metadata as Record<string, unknown>) || null,
    created_by_profile_id: actor.profileId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await doc.save();
  return lean(doc);
}

export async function updateTimesheetTask(userId: string, taskId: string, data: Record<string, unknown>) {
  const task = await TimesheetTask.findOne({ id: taskId });
  if (!task) return null;

  await ensureManagePermission(userId, String(task.location_id || ''));

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof data.task_title === 'string') updates.task_title = data.task_title.trim() || task.task_title;

  if (typeof data.status === 'string' && ['pending', 'submitted', 'missed', 'cancelled'].includes(data.status)) {
    updates.status = data.status;
    if (data.status === 'submitted') updates.submitted_at = new Date().toISOString();
  }

  if (data.due_at) {
    const dueAt = toIso(data.due_at);
    if (!dueAt) throw new Error('due_at must be a valid datetime');
    updates.due_at = dueAt;
  }

  if (data.metadata && typeof data.metadata === 'object') {
    updates.metadata = data.metadata as Record<string, unknown>;
  }

  const updated = await TimesheetTask.findOneAndUpdate({ id: taskId }, { $set: updates }, { new: true });
  return updated ? lean(updated) : null;
}

export async function submitTimesheetTask(userId: string, taskId: string) {
  const task = await TimesheetTask.findOne({ id: taskId });
  if (!task) return null;

  const actor = await getActorContext(userId);
  const isOwner = task.user_id === userId;
  const isManager = ['superadmin', 'super_admin', 'dealer_admin', 'sales_admin'].includes(actor.role || '');

  if (!isOwner && !isManager) {
    throw new Error('Forbidden: you can only submit your own timesheet task');
  }

  const updated = await TimesheetTask.findOneAndUpdate(
    { id: taskId },
    {
      $set: {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    { new: true },
  );

  return updated ? lean(updated) : null;
}

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || '');
}

async function notifyUser(userId: string, payload: { title: string; body: string; type: string; metadata?: Record<string, unknown> }) {
  await createNotification({
    user_id: userId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    metadata: payload.metadata || null,
  });

  try {
    await sendPushToUser(userId, {
      title: payload.title,
      body: payload.body,
      data: payload.metadata
        ? Object.fromEntries(Object.entries(payload.metadata).map(([k, v]) => [k, String(v ?? '')]))
        : undefined,
    });
  } catch {
    // Best-effort push delivery.
  }
}

async function notifyManagersForMissedTask(task: any) {
  const managerRoles = await UserRole.find({ role: { $in: ['sales_admin', 'dealer_admin'] } }, { user_id: 1, role: 1 }).lean();
  const managerUserIds = new Set((managerRoles || []).map((r: any) => r.user_id).filter(Boolean));
  if (managerUserIds.size === 0) return;

  const profiles = await Profile.find(
    {
      user_id: { $in: Array.from(managerUserIds) },
      $or: [{ location_id: task.location_id }, { dealer_id: task.dealer_id }],
    },
    { user_id: 1 },
  ).lean();

  const targets = Array.from(new Set(profiles.map((p: any) => p.user_id).filter(Boolean)));
  if (targets.length === 0) return;

  await Promise.all(
    targets.map((managerUserId) =>
      notifyUser(managerUserId, {
        title: 'Missed timesheet alert',
        body: `${task.task_title} is overdue for user ${task.user_id}.`,
        type: 'timesheet_overdue_manager',
        metadata: { taskId: task.id, assigneeUserId: task.user_id, locationId: task.location_id },
      }),
    ),
  );
}

export async function runTimesheetReminderJobs() {
  const now = new Date();
  const nowMs = now.getTime();

  const windowStart = new Date(nowMs - 12 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(nowMs + 4 * 60 * 60 * 1000).toISOString();

  const tasks = await TimesheetTask.find({
    status: 'pending',
    due_at: { $gte: windowStart, $lte: windowEnd },
  }).lean();

  if (!tasks.length) return { remindersSent: 0, escalationsSent: 0, markedMissed: 0 };

  const locationIds = Array.from(new Set(tasks.map((t: any) => t.location_id).filter(Boolean)));
  const configs = await TimesheetReminderConfig.find({ location_id: { $in: locationIds } }).lean();
  const configMap = new Map(configs.map((c: any) => [c.location_id, c]));

  let remindersSent = 0;
  let escalationsSent = 0;
  let markedMissed = 0;

  for (const task of tasks) {
    const cfg = configMap.get(task.location_id) || {
      reminder_enabled: true,
      reminder_offsets_minutes: [30, 15],
      reminder_message: 'Timesheet due in {{minutes}} minutes at {{dueAt}} for {{taskTitle}}.',
      grace_after_due_minutes: 5,
      escalate_to_manager: true,
    };

    if (!cfg.reminder_enabled) continue;

    const dueMs = new Date(task.due_at).getTime();
    if (Number.isNaN(dueMs)) continue;

    const diffMin = Math.ceil((dueMs - nowMs) / 60000);
    const sentOffsets = Array.isArray(task.sent_offsets) ? task.sent_offsets : [];
    const offsets = resolveOffsets(cfg.reminder_offsets_minutes);

    for (const offset of offsets) {
      const inWindow = diffMin <= offset && diffMin >= offset - 5;
      if (!inWindow) continue;
      if (sentOffsets.includes(offset)) continue;

      const message = fillTemplate(cfg.reminder_message, {
        minutes: String(offset),
        dueAt: new Date(task.due_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        taskTitle: task.task_title,
      });

      await notifyUser(task.user_id, {
        title: 'Timesheet reminder',
        body: message,
        type: 'timesheet_reminder',
        metadata: { taskId: task.id, dueAt: task.due_at, offsetMinutes: offset },
      });

      remindersSent++;

      await TimesheetTask.updateOne(
        { id: task.id },
        {
          $addToSet: { sent_offsets: offset },
          $set: {
            last_reminder_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      );
    }

    const grace = Math.max(0, Math.min(120, Number(cfg.grace_after_due_minutes) || 5));
    const overdueByMin = Math.floor((nowMs - dueMs) / 60000);
    const shouldMarkMissed = overdueByMin >= grace;

    if (shouldMarkMissed) {
      await TimesheetTask.updateOne(
        { id: task.id, status: 'pending' },
        {
          $set: {
            status: 'missed',
            updated_at: new Date().toISOString(),
          },
        },
      );
      markedMissed++;

      if (cfg.escalate_to_manager && !task.escalated_at) {
        await notifyManagersForMissedTask(task);
        await TimesheetTask.updateOne(
          { id: task.id },
          { $set: { escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
        );
        escalationsSent++;
      }
    }
  }

  return { remindersSent, escalationsSent, markedMissed };
}
