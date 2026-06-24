import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserRole } from '../models/UserRole.js';
import { Profile } from '../models/Profile.js';
import { UserRoleAssignmentNew } from '../models/UserRoleAssignmentNew.js';

/**
 * POST /api/admin/reset
 * Superadmin-only. Clears all entity/operational data while preserving
 * superadmin profiles and role records so the system is ready for fresh onboarding.
 */
export async function adminResetController(req: Request, res: Response) {
  const confirmation = req.body?.confirm;
  if (confirmation !== 'RESET_ALL_DATA') {
    res.status(400).json({
      error: 'Missing confirmation. Send { "confirm": "RESET_ALL_DATA" } in the request body.',
    });
    return;
  }

  const db = mongoose.connection.db;
  if (!db) {
    res.status(503).json({ error: 'Database not connected.' });
    return;
  }

  // ── 1. Identify superadmin user IDs to preserve ───────────────────────────
  const superadminRoles = await UserRole.find({
    role: { $in: ['superadmin', 'super_admin'] },
  }, { user_id: 1 }).lean();
  const superadminUserIds = superadminRoles.map((r: any) => r.user_id).filter(Boolean);

  // ── 2. Remove superadmin user_roles ONLY IF they will be re-created ────────
  // (we keep them as-is)

  // ── 3. Delete non-superadmin user_roles ───────────────────────────────────
  await UserRole.deleteMany({
    user_id: { $nin: superadminUserIds },
  });

  // ── 4. Delete non-superadmin profiles ─────────────────────────────────────
  await Profile.deleteMany({
    user_id: { $nin: superadminUserIds },
  });

  // ── 5. Delete all hierarchy role assignments ───────────────────────────────
  await UserRoleAssignmentNew.deleteMany({});

  // ── 6. Collections to wipe entirely ───────────────────────────────────────
  const collectionsToWipe = [
    // New hierarchy
    'organizations',
    'business_units',
    'brands_new',
    'business_unit_brands',
    'sales_offices',
    'plants',
    'locations_new',
    'vehicles_new',
    'leads_new',
    'test_drives_new',
    // Legacy entity data
    'dealers',
    'dealer_integrations',
    'brands',
    'locations',
    'vehicles',
    // Operational data
    'test_drives',
    'car_bookings',
    'customers',
    'vehicle_transits',
    'vehicle_transit_requests',
    'staff_activity_events',
    'staff_activity_sessions',
    'communications',
    'notifications',
    'report_audit_logs',
    'report_dispatch_configs',
    'email_queue',
    'email_send_log',
    'email_send_state',
    'daily_test_drive_reports',
    'agent_conversations',
    'follow_up_reminder_config',
    'location_operating_hours',
    'location_blocked_slots',
    'location_special_periods',
    'test_drive_feedback',
    'email_template_customizations',
  ];

  const results: Record<string, number> = {};
  const existingCollections = await db.listCollections().toArray();
  const existingNames = new Set(existingCollections.map((c: any) => c.name));

  for (const name of collectionsToWipe) {
    if (existingNames.has(name)) {
      const result = await db.collection(name).deleteMany({});
      results[name] = result.deletedCount ?? 0;
    } else {
      results[name] = 0;
    }
  }

  res.json({
    ok: true,
    message: 'Database reset. Superadmin data preserved. Ready for fresh onboarding.',
    preserved: {
      superadmin_user_ids: superadminUserIds,
    },
    cleared: results,
  });
}
