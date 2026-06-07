import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { TestDrive } from '../models/TestDrive.js';
import { Customer } from '../models/Customer.js';
import { Vehicle } from '../models/Vehicle.js';
import { Location } from '../models/Location.js';
import { saveFile } from '../services/storageService.js';
import { env } from '../config/env.js';
import { createPublicTestDrive } from '../services/testDriveService.js';

// ─── Token helpers ────────────────────────────────────────────────────────────

export function generateBookingToken(testDriveId: string): string {
  return createHmac('sha256', env.oauthStateSecret)
    .update(`booking:${testDriveId}`)
    .digest('hex');
}

function verifyBookingToken(testDriveId: string, token: string): boolean {
  try {
    const expected = generateBookingToken(testDriveId);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(token, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getToken(req: Request): string {
  return String(req.query.token || req.body?.token || '');
}

// ─── GET /api/customer/booking/:testDriveId ───────────────────────────────────

export async function getCustomerBookingController(req: Request, res: Response) {
  const { testDriveId } = req.params;
  const token = getToken(req);

  if (!token || !verifyBookingToken(testDriveId, token)) {
    res.status(403).json({ data: null, error: { message: 'Invalid or missing booking token.' } });
    return;
  }

  const td = await TestDrive.findOne({ id: testDriveId }).lean() as any;
  if (!td) {
    res.status(404).json({ data: null, error: { message: 'Booking not found.' } });
    return;
  }
  delete td._id;

  const [customer, vehicle, location] = await Promise.all([
    td.customer_id
      ? Customer.findOne({ id: td.customer_id }, { id: 1, full_name: 1, email: 1, phone: 1, driving_license_url: 1, driving_license_verified: 1 }).lean()
      : null,
    td.vehicle_id
      ? Vehicle.findOne({ id: td.vehicle_id }, { id: 1, brand: 1, model: 1, variant: 1, image_url: 1 }).lean()
      : null,
    td.location_id
      ? Location.findOne({ id: td.location_id }, { id: 1, name: 1, city: 1, address: 1, latitude: 1, longitude: 1 }).lean()
      : null,
  ]);

  res.json({
    data: {
      test_drive: td,
      customer: customer ? { ...customer, _id: undefined } : null,
      vehicle: vehicle ? { ...vehicle, _id: undefined } : null,
      location: location ? { ...location, _id: undefined } : null,
    },
    error: null,
  });
}

// ─── POST /api/customer/booking/:testDriveId/cancel ───────────────────────────

export async function cancelCustomerBookingController(req: Request, res: Response) {
  const { testDriveId } = req.params;
  const token = getToken(req);

  if (!token || !verifyBookingToken(testDriveId, token)) {
    res.status(403).json({ data: null, error: { message: 'Invalid or missing booking token.' } });
    return;
  }

  const td = await TestDrive.findOne({ id: testDriveId }).lean() as any;
  if (!td) {
    res.status(404).json({ data: null, error: { message: 'Booking not found.' } });
    return;
  }

  if (td.status === 'cancelled' || td.status === 'completed') {
    res.status(400).json({ data: null, error: { message: `Cannot cancel a ${td.status} booking.` } });
    return;
  }

  const reason = String(req.body?.reason || 'Cancelled by customer');
  const now = new Date().toISOString();

  await TestDrive.findOneAndUpdate(
    { id: testDriveId },
    {
      $set: {
        status: 'cancelled',
        cancelled_reason: reason,
        cancellation_reason: reason,
        updated_at: now,
      },
    },
  );

  res.json({ data: { success: true }, error: null });
}

// ─── POST /api/customer/booking/:testDriveId/reschedule ───────────────────────

export async function rescheduleCustomerBookingController(req: Request, res: Response) {
  const { testDriveId } = req.params;
  const token = getToken(req);

  if (!token || !verifyBookingToken(testDriveId, token)) {
    res.status(403).json({ data: null, error: { message: 'Invalid or missing booking token.' } });
    return;
  }

  const { scheduled_date, scheduled_time } = req.body || {};
  if (!scheduled_date || !scheduled_time) {
    res.status(400).json({ data: null, error: { message: 'scheduled_date and scheduled_time are required.' } });
    return;
  }

  const td = await TestDrive.findOne({ id: testDriveId }).lean() as any;
  if (!td) {
    res.status(404).json({ data: null, error: { message: 'Booking not found.' } });
    return;
  }

  if (td.status === 'cancelled' || td.status === 'completed') {
    res.status(400).json({ data: null, error: { message: `Cannot reschedule a ${td.status} booking.` } });
    return;
  }

  const now = new Date().toISOString();
  await TestDrive.findOneAndUpdate(
    { id: testDriveId },
    {
      $set: {
        scheduled_date: String(scheduled_date),
        scheduled_time: String(scheduled_time),
        status: 'rescheduled',
        updated_at: now,
      },
    },
  );

  res.json({ data: { success: true }, error: null });
}

// ─── POST /api/customer/booking/:testDriveId/documents ────────────────────────

export async function uploadCustomerDocumentController(req: Request, res: Response) {
  const { testDriveId } = req.params;
  const token = getToken(req);

  if (!token || !verifyBookingToken(testDriveId, token)) {
    res.status(403).json({ data: null, error: { message: 'Invalid or missing booking token.' } });
    return;
  }

  if (!req.file) {
    res.status(400).json({ data: null, error: { message: 'File is required.' } });
    return;
  }

  const td = await TestDrive.findOne({ id: testDriveId }, { id: 1, customer_id: 1 }).lean() as any;
  if (!td) {
    res.status(404).json({ data: null, error: { message: 'Booking not found.' } });
    return;
  }

  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
  if (!allowedExts.includes(ext)) {
    res.status(400).json({ data: null, error: { message: 'Only JPG, PNG, PDF and WebP files are allowed.' } });
    return;
  }

  const fileName = `dl_${td.customer_id}_${Date.now()}.${ext}`;
  const saved = await saveFile('documents', fileName, req.file, true);

  const fileUrl = `${env.publicApiUrl}/api/storage/documents/${encodeURIComponent(saved.path)}`;

  await Customer.findOneAndUpdate(
    { id: td.customer_id },
    { $set: { driving_license_url: fileUrl, updated_at: new Date().toISOString() } },
  );

  res.json({ data: { url: fileUrl, path: saved.path }, error: null });
}

// ─── POST /api/customer/booking/:testDriveId/rebook ───────────────────────────
// Re-create a new booking for the same customer + vehicle + location.
// Requires the original booking to be cancelled (or completed).

export async function rebookCustomerController(req: Request, res: Response) {
  const { testDriveId } = req.params;
  const token = getToken(req);

  if (!token || !verifyBookingToken(testDriveId, token)) {
    res.status(403).json({ data: null, error: { message: 'Invalid or missing booking token.' } });
    return;
  }

  const { scheduled_date, scheduled_time, slot_duration_minutes } = req.body || {};
  if (!scheduled_date || !scheduled_time) {
    res.status(400).json({ data: null, error: { message: 'scheduled_date and scheduled_time are required.' } });
    return;
  }

  const td = await TestDrive.findOne({ id: testDriveId }).lean() as any;
  if (!td) {
    res.status(404).json({ data: null, error: { message: 'Original booking not found.' } });
    return;
  }

  const customer = await Customer.findOne(
    { id: td.customer_id },
    { full_name: 1, phone: 1, email: 1 },
  ).lean() as any;

  if (!customer) {
    res.status(404).json({ data: null, error: { message: 'Customer record not found.' } });
    return;
  }

  try {
    const newTd = await createPublicTestDrive({
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email ?? null,
      vehicle_id: td.vehicle_id,
      location_id: td.location_id,
      scheduled_date: String(scheduled_date),
      scheduled_time: String(scheduled_time),
      slot_duration_minutes: typeof slot_duration_minutes === 'number' ? slot_duration_minutes : (td.slot_duration_minutes ?? 30),
    });

    const newToken = generateBookingToken(newTd.id);
    const manageUrl = `${env.publicFrontendUrl}/customer/booking/${newTd.id}?token=${newToken}`;

    res.status(201).json({ data: { test_drive: newTd, token: newToken, manage_url: manageUrl }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Booking failed';
    res.status(400).json({ data: null, error: { message } });
  }
}
