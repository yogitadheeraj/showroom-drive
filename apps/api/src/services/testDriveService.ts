import { randomUUID } from 'node:crypto';
import { TestDrive, TestDriveStatus } from '../models/TestDrive.js';
import { Customer } from '../models/Customer.js';
import { Vehicle } from '../models/Vehicle.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';
import { UserRole } from '../models/UserRole.js';
import { Notification } from '../models/Notification.js';
import { sendMail } from './mailService.js';
import { notifyTestDriveStatusChange } from './firebaseService.js';
import { getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

export async function listTestDrives(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.customer_id) query.customer_id = filters.customer_id;
  if (filters.vehicle_id) query.vehicle_id = filters.vehicle_id;
  if (filters.sales_person_id) query.assigned_sales_person_id = filters.sales_person_id;
  if (filters.assigned_sales_person_id) query.assigned_sales_person_id = filters.assigned_sales_person_id;
  if (filters.assigned_gro_id) query.assigned_gro_id = filters.assigned_gro_id;
  if (filters.status) query.status = filters.status;
  if (filters.scheduled_date) query.scheduled_date = filters.scheduled_date;
  if (filters.statuses && Array.isArray(filters.statuses)) {
    query.status = { $in: filters.statuses };
  }
  if (filters.ids) {
    const ids = String(filters.ids).split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) query.id = { $in: ids };
  }
  if (filters.created_at_gte) query.created_at = { $gte: String(filters.created_at_gte) };
  if (filters.date_gte || filters.date_lte) {
    const dateQ: Record<string, string> = {};
    if (filters.date_gte) dateQ.$gte = String(filters.date_gte);
    if (filters.date_lte) dateQ.$lte = String(filters.date_lte);
    query.scheduled_date = dateQ;
  }
  const limit = typeof filters.limit === 'number' && filters.limit > 0 ? filters.limit : undefined;
  const includeRelated = filters.include_related !== false;

  const findQuery = TestDrive.find(query)
    .sort({ scheduled_date: -1, scheduled_time: 1 })
    .lean();

  if (limit) {
    findQuery.limit(limit);
  }

  const docs = await findQuery;
  const rows = docs.map((d) => {
    const o = { ...d } as any;
    delete o._id;
    return o;
  });

  if (!includeRelated || rows.length === 0) {
    return rows;
  }

  const customerIds = Array.from(new Set(rows.map((row: any) => row.customer_id).filter(Boolean)));
  const vehicleIds = Array.from(new Set(rows.map((row: any) => row.vehicle_id).filter(Boolean)));
  const locationIds = Array.from(new Set(rows.map((row: any) => row.location_id).filter(Boolean)));
  const assignedProfileIds = Array.from(
    new Set(
      rows
        .flatMap((row: any) => [row.assigned_sales_person_id, row.assigned_gro_id])
        .filter(Boolean)
    )
  );

  const [customers, vehicles, locations, profiles] = await Promise.all([
    customerIds.length > 0
      ? Customer.find({ id: { $in: customerIds } }, { id: 1, full_name: 1, phone: 1, email: 1, driving_license_url: 1, driving_license_verified: 1 }).lean()
      : Promise.resolve([] as any[]),
    vehicleIds.length > 0
      ? Vehicle.find({ id: { $in: vehicleIds } }, { id: 1, brand: 1, model: 1, variant: 1 }).lean()
      : Promise.resolve([] as any[]),
    locationIds.length > 0
      ? Location.find({ id: { $in: locationIds } }, { id: 1, name: 1, city: 1 }).lean()
      : Promise.resolve([] as any[]),
    assignedProfileIds.length > 0
      ? Profile.find({ id: { $in: assignedProfileIds } }, { id: 1, full_name: 1, phone: 1 }).lean()
      : Promise.resolve([] as any[]),
  ]);

  const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
  const vehicleMap = new Map((vehicles || []).map((v: any) => [v.id, v]));
  const locationMap = new Map((locations || []).map((l: any) => [l.id, l]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return rows.map((row: any) => {
    const customer = customerMap.get(row.customer_id);
    const vehicle = vehicleMap.get(row.vehicle_id);
    const location = locationMap.get(row.location_id);
    const assignedSales = row.assigned_sales_person_id ? profileMap.get(row.assigned_sales_person_id) : null;
    const assignedGro = row.assigned_gro_id ? profileMap.get(row.assigned_gro_id) : null;

    return {
      ...row,
      customers: customer
        ? {
            id: customer.id,
            full_name: customer.full_name,
            phone: customer.phone,
            email: customer.email,
            driving_license_url: customer.driving_license_url ?? null,
            driving_license_verified: customer.driving_license_verified ?? false,
          }
        : null,
      vehicles: vehicle
        ? {
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model,
            model_name: vehicle.model,
            variant: vehicle.variant,
          }
        : null,
      locations: location
        ? {
            id: location.id,
            name: location.name,
            city: location.city,
          }
        : null,
      assigned_sales_person: assignedSales
        ? {
            id: assignedSales.id,
            full_name: assignedSales.full_name,
            phone: assignedSales.phone,
          }
        : null,
      assigned_gro: assignedGro
        ? {
            id: assignedGro.id,
            full_name: assignedGro.full_name,
            phone: assignedGro.phone,
          }
        : null,
    };
  });
}

export async function getTestDriveById(id: string) {
  const doc = await TestDrive.findOne({ id }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function createTestDrive(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const assignedGroId = (data.assigned_gro_id as string | null | undefined) ?? (data.gro_id as string | null | undefined) ?? null;
  const cancelledReason = (data.cancelled_reason as string | null | undefined) ?? (data.cancellation_reason as string | null | undefined) ?? null;

  const doc = new TestDrive({
    ...data,
    id: typeof data.id === 'string' && data.id ? data.id : randomUUID(),
    source: typeof data.source === 'string' && data.source ? data.source : 'online',
    assigned_gro_id: assignedGroId,
    gro_id: assignedGroId,
    cancelled_reason: cancelledReason,
    cancellation_reason: cancelledReason,
    slot_duration_minutes:
      typeof data.slot_duration_minutes === 'number' && data.slot_duration_minutes > 0
        ? data.slot_duration_minutes
        : 30,
    status: (data.status as TestDriveStatus) || 'scheduled',
    feedback_submitted: data.feedback_submitted ?? false,
    created_at: now,
    updated_at: now,
  });
  await doc.save();
  // Non-blocking: send emails + in-app notifications
  void sendTestDriveBookedNotifications(toPlain(doc)).catch(() => null);
  // Non-blocking: write real-time creation event to RTDB
  void writeTestDriveEvent({
    test_drive_id:  toPlain(doc).id,
    status:         toPlain(doc).status || 'scheduled',
    customer_id:    toPlain(doc).customer_id || null,
    vehicle_id:     toPlain(doc).vehicle_id || null,
    scheduled_date: toPlain(doc).scheduled_date || null,
    scheduled_time: toPlain(doc).scheduled_time || null,
    location_id:    toPlain(doc).location_id,
  }).catch(() => null);
  return toPlain(doc);
}

export async function updateTestDrive(id: string, data: Record<string, unknown>) {
  const assignedGroId = (data.assigned_gro_id as string | null | undefined) ?? (data.gro_id as string | null | undefined);
  const cancelledReason = (data.cancelled_reason as string | null | undefined) ?? (data.cancellation_reason as string | null | undefined);
  const patch: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (assignedGroId !== undefined) {
    patch.assigned_gro_id = assignedGroId;
    patch.gro_id = assignedGroId;
  }
  if (cancelledReason !== undefined) {
    patch.cancelled_reason = cancelledReason;
    patch.cancellation_reason = cancelledReason;
  }

  const doc = await TestDrive.findOneAndUpdate(
    { id },
    { $set: patch },
    { new: true },
  );
  if (!doc) return null;
  const plain = toPlain(doc);
  // Fire FCM push + Firestore real-time event whenever status is being set
  if (typeof data.status === 'string') {
    void afterStatusChange(plain, data.status as string).catch(() => null);
  }
  return plain;
}

export async function deleteTestDrive(id: string) {
  await TestDrive.deleteOne({ id });
}

export async function countTestDrives(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.status) query.status = filters.status;
  if (filters.statuses && Array.isArray(filters.statuses)) {
    query.status = { $in: filters.statuses };
  }
  if (filters.scheduled_date) query.scheduled_date = filters.scheduled_date;
  return TestDrive.countDocuments(query);
}

// ─── Post-update: FCM push + Firestore real-time event ───────────────────────

async function afterStatusChange(td: any, status: string) {
  const [customer, vehicle, salesProfile, groProfile] = await Promise.all([
    td.customer_id           ? Customer.findOne({ id: td.customer_id }, { full_name: 1 }).lean() : null,
    td.vehicle_id            ? Vehicle.findOne({ id: td.vehicle_id }, { brand: 1, model: 1 }).lean() : null,
    td.assigned_sales_person_id ? Profile.findOne({ id: td.assigned_sales_person_id }, { user_id: 1 }).lean() : null,
    td.assigned_gro_id       ? Profile.findOne({ id: td.assigned_gro_id }, { user_id: 1 }).lean() : null,
  ]);

  const customerName = (customer as any)?.full_name || 'Customer';
  const v = vehicle as any;
  const vehicleName = v ? `${v.brand} ${v.model}`.trim() : 'Vehicle';

  // 1. FCM push notifications + in-app notification persistence
  await notifyTestDriveStatusChange(status, {
    testDriveId:          td.id,
    customerId:           td.customer_id,
    locationId:           td.location_id,
    customerName,
    vehicleName,
    assignedSalesUserId:  (salesProfile as any)?.user_id,
    assignedGroUserId:    (groProfile as any)?.user_id,
    scheduledDate:        td.scheduled_date,
    scheduledTime:        td.scheduled_time,
  }).catch(() => null);

  // 2. Realtime Database signal — one record per location, overwritten each time
  await writeTestDriveEvent({
    test_drive_id:  td.id,
    status,
    customer_id:  td.customer_id,
    vehicle_id:   td.vehicle_id,
    scheduled_date: td.scheduled_date || null,
    scheduled_time: td.scheduled_time || null,
    location_id:    td.location_id,
  });
}

// ─── Write a real-time event to Firebase Realtime Database ───────────────────

async function writeTestDriveEvent(data: {
  test_drive_id: string;
  status: string;
  customer_id: string;
  vehicle_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location_id: string;
}) {
  if (!getApps().length || !data.location_id) return;
  try {
    const db = getDatabase();
    await db.ref(`test_drive_events/${data.location_id}/${data.test_drive_id}`).set({
      ...data,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // RTDB not available — silently skip
  }
}

// ─── Post-create: emails + in-app notifications ─────────────────────────────

async function sendTestDriveBookedNotifications(td: any) {
  const [customer, vehicle, location] = await Promise.all([
    td.customer_id ? Customer.findOne({ id: td.customer_id }, { full_name: 1, email: 1, phone: 1 }).lean() : null,
    td.vehicle_id  ? Vehicle.findOne({ id: td.vehicle_id }, { brand: 1, model: 1, variant: 1 }).lean() : null,
    td.location_id ? Location.findOne({ id: td.location_id }, { name: 1 }).lean() : null,
  ]);

  const c = customer as any;
  const v = vehicle  as any;
  const l = location as any;

  const vehicleName   = v ? `${v.brand} ${v.model}`.trim() : 'Vehicle';
  const locationName  = l?.name || '';
  const customerName  = c?.full_name || 'Customer';
  const scheduledDate = td.scheduled_date || '';
  const scheduledTime = td.scheduled_time || '';
  const dateLabel     = scheduledTime ? `${scheduledDate} at ${scheduledTime}` : scheduledDate;

  // ── 1. Email: customer ────────────────────────────────────────────────────
  if (c?.email) {
    await sendMail({
      to: c.email,
      subject: `Test Drive Confirmed — ${vehicleName}`,
      html: testDriveCustomerEmailHtml({ customerName, vehicleName, locationName, dateLabel }),
    }).catch(() => null);
  }

  // ── 2. Look up all profiles at the same location ──────────────────────────
  const locationProfiles: any[] = td.location_id
    ? (await Profile.find({ location_id: td.location_id }, { id: 1, user_id: 1, full_name: 1, email: 1 }).lean())
    : [];

  if (!locationProfiles.length) return;

  const userIds = locationProfiles.map((p: any) => p.user_id).filter(Boolean);
  const roleRows: any[] = userIds.length
    ? (await UserRole.find({ user_id: { $in: userIds } }, { user_id: 1, role: 1 }).lean())
    : [];

  const roleMap = new Map(roleRows.map((r: any) => [r.user_id, r.role]));
  const profileByUserId = new Map(locationProfiles.map((p: any) => [p.user_id, p]));

  const adminRoles = new Set(['dealer_admin', 'sales_admin', 'branch_admin', 'superadmin', 'super_admin']);
  const notifyRoles = new Set(['gro', 'security']);

  // ── 3. Email: assigned sales person ──────────────────────────────────────
  if (td.assigned_sales_person_id) {
    const salesProfile = locationProfiles.find((p: any) => p.id === td.assigned_sales_person_id);
    if (salesProfile?.email) {
      await sendMail({
        to: salesProfile.email,
        subject: `New Test Drive Assigned — ${vehicleName}`,
        html: testDriveStaffEmailHtml({
          recipientName: salesProfile.full_name || 'Sales Person',
          role: 'Sales Person',
          customerName,
          vehicleName,
          locationName,
          dateLabel,
          testDriveId: td.id,
        }),
      }).catch(() => null);
    }
  }

  // ── 4. Email: admin staff (dealer_admin, sales_admin, branch_admin) ───────
  for (const [uid, role] of roleMap) {
    if (!adminRoles.has(role)) continue;
    const p = profileByUserId.get(uid);
    if (!p?.email) continue;
    // Skip duplicate if this admin is also the assigned sales person
    if (p.id === td.assigned_sales_person_id) continue;

    await sendMail({
      to: p.email,
      subject: `New Test Drive Booked — ${vehicleName}`,
      html: testDriveStaffEmailHtml({
        recipientName: p.full_name || role,
        role: role.replace('_', ' '),
        customerName,
        vehicleName,
        locationName,
        dateLabel,
        testDriveId: td.id,
      }),
    }).catch(() => null);
  }

  // ── 5. In-app notification: GRO & security ────────────────────────────────
  const now = new Date().toISOString();
  const notifyPayloads = [];

  for (const [uid, role] of roleMap) {
    if (!notifyRoles.has(role)) continue;
    const p = profileByUserId.get(uid);
    notifyPayloads.push({
      id: randomUUID(),
      user_id: uid,
      profile_id: p?.id || null,
      location_id: td.location_id,
      title: 'New Test Drive Scheduled',
      body: `${customerName} — ${vehicleName} on ${dateLabel}`,
      type: 'test_drive_scheduled',
      reference_id: td.id,
      reference_type: 'test_drive',
      is_read: false,
      read_at: null,
      metadata: {
        test_drive_id: td.id,
        customer_name: customerName,
        vehicle_name: vehicleName,
        location_name: locationName,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
      },
      created_at: now,
    });
  }

  if (notifyPayloads.length) {
    await Notification.insertMany(notifyPayloads, { ordered: false }).catch(() => null);
  }
}

// ─── Email templates ─────────────────────────────────────────────────────────

function testDriveCustomerEmailHtml(p: { customerName: string; vehicleName: string; locationName: string; dateLabel: string }) {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#2563eb">Test Drive Confirmed!</h2>
  <p>Dear ${p.customerName},</p>
  <p>Your test drive has been successfully scheduled. Here are your details:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border:1px solid #eee;color:#666;width:40%">Vehicle</td><td style="padding:8px;border:1px solid #eee;font-weight:600">${p.vehicleName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Showroom</td><td style="padding:8px;border:1px solid #eee">${p.locationName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Date &amp; Time</td><td style="padding:8px;border:1px solid #eee;font-weight:600;color:#2563eb">${p.dateLabel}</td></tr>
  </table>
  <p>Please arrive a few minutes early. Bring a valid driving licence.</p>
  <p>We look forward to seeing you!</p>
  <p style="color:#666;font-size:12px;margin-top:24px">This is an automated notification. Please do not reply directly to this email.</p>
</div>`;
}

function testDriveStaffEmailHtml(p: { recipientName: string; role: string; customerName: string; vehicleName: string; locationName: string; dateLabel: string; testDriveId: string }) {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#2563eb">New Test Drive — Action Required</h2>
  <p>Hi ${p.recipientName},</p>
  <p>A new test drive has been booked at <strong>${p.locationName}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border:1px solid #eee;color:#666;width:40%">Customer</td><td style="padding:8px;border:1px solid #eee;font-weight:600">${p.customerName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Vehicle</td><td style="padding:8px;border:1px solid #eee">${p.vehicleName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Date &amp; Time</td><td style="padding:8px;border:1px solid #eee;font-weight:600;color:#2563eb">${p.dateLabel}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Your Role</td><td style="padding:8px;border:1px solid #eee;text-transform:capitalize">${p.role}</td></tr>
  </table>
  <p style="color:#666;font-size:12px;margin-top:24px">Test Drive ID: ${p.testDriveId}</p>
  <p style="color:#666;font-size:12px">This is an automated notification. Please do not reply directly to this email.</p>
</div>`;
}
