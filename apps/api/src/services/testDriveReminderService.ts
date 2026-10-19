/**
 * testDriveReminderService.ts
 * ───────────────────────────
 * Scheduled email reminders and post-drive communications for test drives.
 *
 * Jobs use TestDrive flags and completion-email queue/send-log checks:
 *   1. 24h reminder  — sent ~24 h before scheduled time
 *   2. 4h  reminder  — sent ~4 h before scheduled time
 *   3. No-show re-engagement — sent when status = 'no_show'
 *   4. Post-drive thank-you  — sent when status = 'completed'
 *
 * Called by the scheduler in index.ts every 15 minutes.
 */

import { TestDrive, type ITestDrive } from '../models/TestDrive.js';
import { Customer } from '../models/Customer.js';
import { Profile } from '../models/Profile.js';
import { Location } from '../models/Location.js';
import { Vehicle } from '../models/Vehicle.js';
import { sendMail } from './mailService.js';
import {
  testDriveReminder24hTemplate,
  testDriveReminder4hTemplate,
  testDriveNoShowReengagementTemplate,
} from '../templates/emailTemplates.js';
import { generateBookingToken } from '../controllers/customerBookingController.js';
import { env } from '../config/env.js';
import { EmailQueue } from '../models/EmailQueue.js';
import { isAlreadySent } from './emailQueueService.js';
import { sendTransactionalEmail } from './reportEmailService.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scheduledDateTimeMs(drive: any): number {
  // scheduled_date = 'YYYY-MM-DD', scheduled_time = 'HH:mm:ss' or 'HH:mm'
  const timeStr = (drive.scheduled_time || '00:00').substring(0, 5);
  return new Date(`${drive.scheduled_date}T${timeStr}:00`).getTime();
}

function vehicleLabel(v: any): string {
  if (!v) return '';
  return [v.brand, v.model, v.variant].filter(Boolean).join(' ');
}

function bookingUrl(): string {
  const origin = env.corsOrigin || 'https://app.autoadvant.com';
  return `${origin}/book`;
}

function manageUrl(testDriveId: string): string {
  const origin = env.corsOrigin || 'https://app.autoadvant.com';
  const token = generateBookingToken(testDriveId);
  return `${origin}/customer/booking/${testDriveId}?token=${token}`;
}

// ── Send helpers (no-throw) ───────────────────────────────────────────────────

async function trySend(to: string, template: { subject: string; html: string; text: string }): Promise<boolean> {
  try {
    const result = await sendMail({ to, subject: template.subject, html: template.html, text: template.text });
    return !result.skipped;
  } catch (err) {
    console.error('[testDriveReminder] sendMail error', err);
    return false;
  }
}

// ── Main jobs ──────────────────────────────────────────────────────────────────

/**
 * Send 24h and 4h reminders for upcoming scheduled/confirmed test drives.
 */
export async function sendUpcomingReminders(): Promise<{ sent24h: number; sent4h: number }> {
  const now = Date.now();
  const stats = { sent24h: 0, sent4h: 0 };

  // Fetch drives scheduled in the next 25h that haven't been cancelled/completed/no-show
  const tomorrow = new Date(now + 25 * 3600_000).toISOString().split('T')[0];
  const today    = new Date(now - 3600_000).toISOString().split('T')[0]; // -1h buffer

  const drives = await TestDrive.find({
    scheduled_date: { $gte: today, $lte: tomorrow },
    status: { $in: ['scheduled', 'confirmed', 'show'] },
    $or: [{ reminder_sent_24h: { $ne: true } }, { reminder_sent_4h: { $ne: true } }],
  }).lean();

  for (const drive of drives) {
    const driveMs = scheduledDateTimeMs(drive);
    const diffMs  = driveMs - now;

    // Skip drives already in the past
    if (diffMs < 0) continue;

    // Load customer email
    const customer = await Customer.findOne({ id: drive.customer_id }, { email: 1, full_name: 1 }).lean();
    if (!customer?.email) continue;

    // Load location + vehicle + sales person in parallel
    const [location, vehicle, salesPerson] = await Promise.all([
      Location.findOne({ id: drive.location_id }, { name: 1 }).lean(),
      Vehicle.findOne({ id: drive.vehicle_id }, { brand: 1, model: 1, variant: 1 }).lean(),
      drive.assigned_sales_person_id
        ? Profile.findOne({ id: drive.assigned_sales_person_id }, { full_name: 1, phone: 1 }).lean()
        : null,
    ]);

    const templateData = {
      customerName: customer.full_name || customer.email,
      vehicleName: vehicleLabel(vehicle),
      locationName: (location as any)?.name ?? '',
      scheduledDate: drive.scheduled_date,
      scheduledTime: (drive.scheduled_time || '').substring(0, 5),
      salesPersonName: (salesPerson as any)?.full_name ?? '',
    };

    // ── 24h reminder: 20h – 25h before ──────────────────────────
    if (!drive.reminder_sent_24h && diffMs >= 20 * 3600_000 && diffMs <= 25 * 3600_000) {
      const tpl = testDriveReminder24hTemplate(templateData);
      const sent = await trySend(customer.email, tpl);
      if (sent) {
        await TestDrive.updateOne({ id: drive.id }, { $set: { reminder_sent_24h: true } });
        stats.sent24h++;
        console.log(`[testDriveReminder] 24h reminder sent → ${customer.email} (td:${drive.id})`);
      }
    }

    // ── 4h reminder: 3h – 5h before ────────────────────────────
    if (!drive.reminder_sent_4h && diffMs >= 3 * 3600_000 && diffMs <= 5 * 3600_000) {
      const tpl = testDriveReminder4hTemplate(templateData);
      const sent = await trySend(customer.email, tpl);
      if (sent) {
        await TestDrive.updateOne({ id: drive.id }, { $set: { reminder_sent_4h: true } });
        stats.sent4h++;
        console.log(`[testDriveReminder] 4h reminder sent → ${customer.email} (td:${drive.id})`);
      }
    }
  }

  return stats;
}

/**
 * Send no-show re-engagement email for drives marked no_show in the last 48h.
 */
export async function sendNoShowReengagement(): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  const stats = { sent: 0 };

  const drives = await TestDrive.find({
    status: 'no_show',
    no_show_reengagement_sent: { $ne: true },
    updated_at: { $gte: cutoff },
  }).lean();

  for (const drive of drives) {
    const customer = await Customer.findOne({ id: drive.customer_id }, { email: 1, full_name: 1 }).lean();
    if (!customer?.email) continue;

    const [location, vehicle] = await Promise.all([
      Location.findOne({ id: drive.location_id }, { name: 1 }).lean(),
      Vehicle.findOne({ id: drive.vehicle_id }, { brand: 1, model: 1, variant: 1 }).lean(),
    ]);

    const tpl = testDriveNoShowReengagementTemplate({
      customerName: customer.full_name || customer.email,
      vehicleName: vehicleLabel(vehicle),
      locationName: (location as any)?.name ?? '',
      bookingUrl: bookingUrl(),
      manageUrl: manageUrl(drive.id),
    });

    const sent = await trySend(customer.email, tpl);
    if (sent) {
      await TestDrive.updateOne({ id: drive.id }, { $set: { no_show_reengagement_sent: true } });
      stats.sent++;
      console.log(`[testDriveReminder] no-show re-engagement sent → ${customer.email} (td:${drive.id})`);
    }
  }

  return stats;
}

export async function queueTestDriveCompletionEmail(drive: Pick<ITestDrive,
  'id' | 'status' | 'customer_id' | 'vehicle_id' | 'location_id' | 'assigned_sales_person_id' |
  'scheduled_date' | 'security_checked_in_at' | 'security_checked_out_at' | 'started_at' | 'completed_at'
>): Promise<boolean> {
  if (drive.status !== 'completed') return false;

  const messageId = `test-drive-completed-${drive.id}`;
  if (await isAlreadySent(messageId)) {
    await TestDrive.updateOne({ id: drive.id }, { $set: { thank_you_sent: true } });
    return false;
  }
  if (await EmailQueue.exists({ 'message.message_id': messageId, deleted_at: null })) return false;

  const customer = await Customer.findOne({ id: drive.customer_id }, { email: 1, full_name: 1 }).lean();
  if (!customer?.email) {
    console.warn(`[testDriveReminder] completion email skipped: no customer email (td:${drive.id})`);
    return false;
  }

  const [location, vehicle, salesPerson] = await Promise.all([
    Location.findOne({ id: drive.location_id }, { name: 1 }).lean(),
    Vehicle.findOne({ id: drive.vehicle_id }, { brand: 1, model: 1, variant: 1 }).lean(),
    drive.assigned_sales_person_id
      ? Profile.findOne({ id: drive.assigned_sales_person_id }, { full_name: 1, phone: 1 }).lean()
      : null,
  ]);
  const feedbackUrl = new URL('/test-drive-feedback', env.publicFrontendUrl);
  feedbackUrl.searchParams.set('td', drive.id);
  const start = drive.security_checked_in_at || drive.started_at;
  const end = drive.security_checked_out_at || drive.completed_at;
  const duration = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000) : null;

  await sendTransactionalEmail({
    recipientEmail: customer.email,
    templateName: 'test-drive-completed',
    messageId,
    templateData: {
      customerName: customer.full_name || customer.email,
      vehicleName: vehicleLabel(vehicle),
      locationName: location?.name || '',
      location_id: drive.location_id,
      scheduledDate: drive.scheduled_date,
      salesPersonName: salesPerson?.full_name || '',
      durationMinutes: duration !== null && Number.isFinite(duration) && duration > 0 ? duration : undefined,
      feedbackLink: feedbackUrl.toString(),
    },
  });
  console.log(`[testDriveReminder] completion email queued (td:${drive.id})`);
  return true;
}

/**
 * Recover completion emails missed during the immediate completion request.
 */
export async function sendPostDriveThankYou(): Promise<{ queued: number }> {
  const cutoff = new Date(Date.now() - 2 * 3600_000).toISOString();
  const stats = { queued: 0 };

  const drives = await TestDrive.find({
    status: 'completed',
    thank_you_sent: { $ne: true },
    updated_at: { $gte: cutoff },
  }).lean();

  for (const drive of drives) {
    if (await queueTestDriveCompletionEmail(drive)) {
      stats.queued++;
    }
  }

  return stats;
}

/**
 * Master runner — called by the scheduler. Runs all jobs sequentially.
 */
export async function runTestDriveReminderJobs(): Promise<void> {
  try {
    const [rem, noShow, thanks] = await Promise.all([
      sendUpcomingReminders(),
      sendNoShowReengagement(),
      sendPostDriveThankYou(),
    ]);
    const total = rem.sent24h + rem.sent4h + noShow.sent + thanks.queued;
    if (total > 0) {
      console.log(`[testDriveReminder] Batch complete — 24h:${rem.sent24h} 4h:${rem.sent4h} no-show:${noShow.sent} completion queued:${thanks.queued}`);
    }
  } catch (err) {
    console.error('[testDriveReminder] Batch error', err);
  }
}
