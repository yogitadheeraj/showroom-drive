import { TestDrive } from '../models/TestDrive.js';
import { Customer } from '../models/Customer.js';
import { Vehicle } from '../models/Vehicle.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';
import { StaffActivityEvent } from '../models/StaffActivityEvent.js';
import { ENTITY_ORCHESTRATION } from '../config/entityOrchestration.js';

type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: 'string' | 'number' | 'boolean'; description?: string }>;
  required?: string[];
};

export interface AgentTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

// ── Tool definitions for Gemini/OpenAI-compatible APIs ─────────────────────

export const AGENT_TOOLS: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_test_drive_stats',
      description:
        'Get a summary count of test drives by status for a given location and date range. Returns total, completed, no_show, scheduled, cancelled counts and completion rate.',
      parameters: {
        type: 'object',
        properties: {
          location_id: { type: 'string', description: `The ${ENTITY_ORCHESTRATION.location.toLowerCase()} ID. Use the user's assigned ${ENTITY_ORCHESTRATION.location.toLowerCase()} if not specified.` },
          date_from: { type: 'string', description: 'Start date YYYY-MM-DD (default: today)' },
          date_to: { type: 'string', description: 'End date YYYY-MM-DD (default: today)' },
        },
        required: ['location_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_test_drives',
      description:
        `List recent test drives for a ${ENTITY_ORCHESTRATION.location.toLowerCase()} with customer, vehicle and status details. Returns up to 20 most recent entries.`,
      parameters: {
        type: 'object',
        properties: {
          location_id: { type: 'string', description: `The ${ENTITY_ORCHESTRATION.location.toLowerCase()} ID.` },
          status: { type: 'string', description: 'Filter by status: scheduled|confirmed|show|in_progress|completed|no_show|cancelled|rescheduled' },
          date: { type: 'string', description: 'Filter by scheduled date YYYY-MM-DD' },
          limit: { type: 'number', description: 'Max records to return (max 20)' },
        },
        required: ['location_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_info',
      description: 'Look up a customer by name or phone number. Returns contact details and recent test drive history.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Customer name or phone number to search for.' },
          location_id: { type: 'string', description: `Optional: restrict search to a specific ${ENTITY_ORCHESTRATION.location.toLowerCase()}.` },
        },
        required: ['search'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vehicle_availability',
      description: `Check vehicle availability and inventory at a ${ENTITY_ORCHESTRATION.location.toLowerCase()}. Returns available units per vehicle.`,
      parameters: {
        type: 'object',
        properties: {
          location_id: { type: 'string', description: `The ${ENTITY_ORCHESTRATION.location.toLowerCase()} ID.` },
          brand: { type: 'string', description: 'Optional: filter by brand name.' },
        },
        required: ['location_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_staff_activity_summary',
      description: `Get a summary of staff activity events for a ${ENTITY_ORCHESTRATION.location.toLowerCase()} on a given date. Shows event counts by type and by role.`,
      parameters: {
        type: 'object',
        properties: {
          location_id: { type: 'string', description: `The ${ENTITY_ORCHESTRATION.location.toLowerCase()} ID.` },
          date: { type: 'string', description: 'Date YYYY-MM-DD (default: today).' },
        },
        required: ['location_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_location_info',
      description: `Get details about a ${ENTITY_ORCHESTRATION.location.toLowerCase()} including name, city, operating status and linked ${ENTITY_ORCHESTRATION.dealer.toLowerCase()}.`,
      parameters: {
        type: 'object',
        properties: {
          location_id: { type: 'string', description: `The ${ENTITY_ORCHESTRATION.location.toLowerCase()} ID.` },
        },
        required: ['location_id'],
      },
    },
  },
];

// ── Tool Executors ────────────────────────────────────────────────────────────

async function getTestDriveStats(args: {
  location_id: string;
  date_from?: string;
  date_to?: string;
}): Promise<object> {
  const today = new Date().toISOString().slice(0, 10);
  const from = args.date_from || today;
  const to   = args.date_to   || today;

  const drives = await TestDrive.find({
    location_id: args.location_id,
    scheduled_date: { $gte: from, $lte: to },
  }, { status: 1 }).lean();

  const counts: Record<string, number> = {
    total: drives.length,
    scheduled: 0, confirmed: 0, show: 0, in_progress: 0,
    completed: 0, no_show: 0, cancelled: 0, rescheduled: 0,
  };
  for (const d of drives) {
    const s = String(d.status);
    if (s in counts) counts[s]++;
  }

  const completion_rate = counts.total > 0
    ? `${Math.round((counts.completed / counts.total) * 100)}%`
    : '0%';

  return { ...counts, completion_rate, date_from: from, date_to: to };
}

async function listRecentTestDrives(args: {
  location_id: string;
  status?: string;
  date?: string;
  limit?: number;
}): Promise<object[]> {
  const query: Record<string, unknown> = { location_id: args.location_id };
  if (args.status) query.status = args.status;
  if (args.date)   query.scheduled_date = args.date;

  const limit = Math.min(args.limit ?? 10, 20);
  const drives = await TestDrive.find(query)
    .sort({ scheduled_date: -1, scheduled_time: -1 })
    .limit(limit)
    .lean();

  const customerIds = Array.from(new Set(drives.map((d) => d.customer_id).filter(Boolean)));
  const vehicleIds  = Array.from(new Set(drives.map((d) => d.vehicle_id).filter(Boolean)));

  const [customers, vehicles] = await Promise.all([
    customerIds.length ? Customer.find({ id: { $in: customerIds } }, { id: 1, full_name: 1, phone: 1 }).lean() : [],
    vehicleIds.length  ? Vehicle.find({  id: { $in: vehicleIds  } }, { id: 1, brand: 1, model: 1, variant: 1 }).lean() : [],
  ]);

  const cm = new Map((customers as any[]).map((c) => [c.id, c]));
  const vm = new Map((vehicles  as any[]).map((v) => [v.id, v]));

  return drives.map((d) => {
    const c = cm.get(d.customer_id);
    const v = vm.get(d.vehicle_id);
    return {
      id: d.id,
      status: d.status,
      scheduled_date: d.scheduled_date,
      scheduled_time: d.scheduled_time,
      customer_name: c?.full_name || null,
      customer_phone: c?.phone || null,
      vehicle: v ? `${v.brand} ${v.model}${v.variant ? ' ' + v.variant : ''}` : null,
    };
  });
}

async function getCustomerInfo(args: { search: string; location_id?: string }): Promise<object[]> {
  const s = args.search.trim();
  const isPhone = /^\d/.test(s);

  const query: Record<string, unknown> = isPhone
    ? { phone: { $regex: s.replace(/[^0-9+]/g, ''), $options: 'i' } }
    : { full_name: { $regex: s, $options: 'i' } };

  const customers = await Customer.find(query, {
    id: 1, full_name: 1, phone: 1, email: 1,
  }).limit(5).lean();

  const results: object[] = [];
  for (const c of customers as any[]) {
    const driveQuery: Record<string, unknown> = { customer_id: c.id };
    if (args.location_id) driveQuery.location_id = args.location_id;

    const recent = await TestDrive.find(driveQuery, { status: 1, scheduled_date: 1 })
      .sort({ scheduled_date: -1 })
      .limit(3)
      .lean();

    results.push({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email,
      recent_test_drives: recent.map((d) => ({ date: d.scheduled_date, status: d.status })),
    });
  }
  return results;
}

async function getVehicleAvailability(args: { location_id: string; brand?: string }): Promise<object[]> {
  const query: Record<string, unknown> = { location_id: args.location_id, is_active: true };
  if (args.brand) query.brand = { $regex: args.brand, $options: 'i' };

  const vehicles = await Vehicle.find(query, {
    id: 1, brand: 1, model: 1, variant: 1, available_units: 1, total_units: 1,
    vehicle_condition: 1, is_demo: 1,
  }).lean();

  return (vehicles as any[]).map((v) => ({
    id: v.id,
    name: `${v.brand} ${v.model}${v.variant ? ' ' + v.variant : ''}`,
    condition: v.vehicle_condition || (v.is_demo ? 'demo' : 'new'),
    available_units: v.available_units ?? 0,
    total_units: v.total_units ?? 0,
    available: (v.available_units ?? 0) > 0,
  }));
}

async function getStaffActivitySummary(args: { location_id: string; date?: string }): Promise<object> {
  const date = args.date || new Date().toISOString().slice(0, 10);
  const events = await StaffActivityEvent.find({
    location_id: args.location_id,
    happened_at: { $gte: `${date}T00:00:00`, $lte: `${date}T23:59:59` },
  }, { event_type: 1, role: 1 }).lean();

  const byType: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  for (const e of events as any[]) {
    byType[e.event_type] = (byType[e.event_type] || 0) + 1;
    if (e.role) byRole[e.role] = (byRole[e.role] || 0) + 1;
  }

  return { date, total_events: events.length, by_type: byType, by_role: byRole };
}

async function getLocationInfo(args: { location_id: string }): Promise<object | null> {
  const loc = await Location.findOne({ id: args.location_id }).lean();
  if (!loc) return null;
  return {
    id: (loc as any).id,
    name: (loc as any).name,
    city: (loc as any).city,
    state: (loc as any).state,
    is_active: (loc as any).is_active,
    slot_duration_minutes: (loc as any).slot_duration_minutes,
    dealer_id: (loc as any).dealer_id,
  };
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'get_test_drive_stats':
      return getTestDriveStats(args as any);
    case 'list_recent_test_drives':
      return listRecentTestDrives(args as any);
    case 'get_customer_info':
      return getCustomerInfo(args as any);
    case 'get_vehicle_availability':
      return getVehicleAvailability(args as any);
    case 'get_staff_activity_summary':
      return getStaffActivitySummary(args as any);
    case 'get_location_info':
      return getLocationInfo(args as any);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
