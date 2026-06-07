/**
 * Fleet E2E Test Seed Script
 * Run: npx tsx src/scripts/seedFleetTest.ts
 *
 * What it does:
 *  1. Patches 2 existing locations with real Mumbai coordinates (for OSRM routing)
 *  2. Marks one demo vehicle as is_shared = true
 *  3. Creates 2 test drives for that vehicle at different locations (today + tomorrow)
 *  4. Prints the fleet overview + availability check
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// Load .env explicitly from apps/api directory
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });
import { env } from '../config/env.js';
import { Vehicle } from '../models/Vehicle.js';
import { Location } from '../models/Location.js';
import { TestDrive } from '../models/TestDrive.js';
import { Customer } from '../models/Customer.js';
import { randomUUID } from 'node:crypto';
import { getFleetOverview, getVehicleAvailabilityAtLocation } from '../services/vehicleFleetService.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg: string) { console.log(msg); }
function ok(msg: string) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function info(msg: string) { console.log(`${BLUE}ℹ${RESET} ${msg}`); }
function warn(msg: string) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }

const MUMBAI_LOCATIONS = [
  { name: 'Bandra West Showroom', city: 'Mumbai', lat: '19.0596', lng: '72.8295', address: 'Linking Road, Bandra West, Mumbai' },
  { name: 'Powai Showroom',       city: 'Mumbai', lat: '19.1176', lng: '72.9060', address: 'Hiranandani Estate, Powai, Mumbai' },
];

async function run() {
  log(`\n${BOLD}═══ Fleet E2E Test Seed ═══${RESET}\n`);
  await mongoose.connect(env.mongoUri);
  ok('Connected to MongoDB');

  // ─── STEP 1: Find or create 2 locations with GPS ──────────────────────────
  log(`\n${BOLD}STEP 1: Locations${RESET}`);
  const locationIds: string[] = [];

  const existingLocs = await Location.find({ is_active: true }).sort({ name: 1 }).lean();
  log(`Found ${existingLocs.length} existing locations`);

  // Reuse existing ones, just patch their coordinates
  const locsToUse = existingLocs.slice(0, 2);

  if (locsToUse.length < 2) {
    // Create 2 new locations
    for (const ml of MUMBAI_LOCATIONS) {
      const id = randomUUID();
      await Location.create({
        id, name: ml.name, city: ml.city, address: ml.address,
        latitude: ml.lat, longitude: ml.lng,
        is_active: true, slot_duration_minutes: 30,
        max_concurrent_test_drives: 2, advance_booking_days: 30,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      locationIds.push(id);
      ok(`Created location: ${ml.name} (${ml.lat}, ${ml.lng})`);
    }
  } else {
    // Patch existing locations with Mumbai coords
    for (let i = 0; i < 2; i++) {
      const loc = locsToUse[i];
      const ml = MUMBAI_LOCATIONS[i];
      await Location.updateOne({ id: loc.id }, {
        $set: { latitude: ml.lat, longitude: ml.lng, updated_at: new Date().toISOString() }
      });
      locationIds.push(String(loc.id));
      ok(`Patched location "${loc.name ?? loc.id}" → coords (${ml.lat}, ${ml.lng}) [${ml.name}]`);
    }
  }

  const [locA, locB] = locationIds;
  info(`Location A (origin):      ${locA}`);
  info(`Location B (destination): ${locB}`);

  // ─── STEP 2: Find a demo vehicle and mark it as shared ────────────────────
  log(`\n${BOLD}STEP 2: Shared Vehicle${RESET}`);

  let vehicle = await Vehicle.findOne({ is_demo: true, is_active: true, location_id: locA }).lean();
  if (!vehicle) {
    vehicle = await Vehicle.findOne({ is_active: true, location_id: locA }).lean();
  }
  if (!vehicle) {
    vehicle = await Vehicle.findOne({ is_active: true }).lean();
  }

  if (!vehicle) {
    // Create a dummy vehicle
    const vid = randomUUID();
    vehicle = await Vehicle.create({
      id: vid, brand: 'BMW', model: '3 Series', variant: '320d M Sport',
      year: 2025, color: 'Alpine White', fuel_type: 'Diesel',
      location_id: locA, is_active: true, is_available: true, is_demo: true,
      available_units: 1, total_units: 1,
      is_shared: true, current_location_id: locA, transit_status: 'at_location',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    ok(`Created test vehicle: BMW 3 Series (${vid})`);
  } else {
    await Vehicle.updateOne({ id: vehicle.id }, {
      $set: {
        is_shared: true,
        current_location_id: locA,
        transit_status: 'at_location',
        transit_eta: null,
        transit_to_location_id: null,
        updated_at: new Date().toISOString(),
      }
    });
    ok(`Marked vehicle as shared: ${vehicle.brand} ${vehicle.model} (${vehicle.id})`);
  }

  const vehicleId = String(vehicle.id);
  info(`Vehicle ID: ${vehicleId}`);
  info(`Home location: ${locA}`);

  // ─── STEP 3: Find or create a test customer ───────────────────────────────
  log(`\n${BOLD}STEP 3: Test Customer${RESET}`);

  let customer = await Customer.findOne({ phone: '+91-TEST-FLEET' }).lean();
  if (!customer) {
    customer = await Customer.create({
      id: randomUUID(),
      full_name: 'Fleet Test Customer',
      phone: '+91-TEST-FLEET',
      email: 'fleet-test@demo.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    ok(`Created test customer: Fleet Test Customer`);
  } else {
    ok(`Found existing test customer: ${customer.full_name}`);
  }
  const customerId = String(customer.id);

  // ─── STEP 4: Create 2 test drives at different locations ─────────────────
  log(`\n${BOLD}STEP 4: Test Drives${RESET}`);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Clean up old test fleet drives
  await TestDrive.deleteMany({
    vehicle_id: vehicleId,
    'metadata.created_via': 'fleet_test_seed',
  });

  const td1Id = randomUUID();
  const td2Id = randomUUID();

  await TestDrive.create({
    id: td1Id,
    customer_id: customerId,
    vehicle_id: vehicleId,
    location_id: locA,
    scheduled_date: today,
    scheduled_time: '11:00:00',
    slot_duration_minutes: 60,
    source: 'walkin',
    status: 'show',
    metadata: { created_via: 'fleet_test_seed', note: 'Drive 1 at Location A (Bandra)' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  ok(`Created Drive 1: ${today} 11:00 at Location A (${locA})`);

  await TestDrive.create({
    id: td2Id,
    customer_id: customerId,
    vehicle_id: vehicleId,
    location_id: locB,
    scheduled_date: tomorrow,
    scheduled_time: '10:00:00',
    slot_duration_minutes: 60,
    source: 'online',
    status: 'scheduled',
    metadata: { created_via: 'fleet_test_seed', note: 'Drive 2 at Location B (Powai)' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  ok(`Created Drive 2: ${tomorrow} 10:00 at Location B (${locB})`);

  // ─── STEP 5: Check availability at Location B ─────────────────────────────
  log(`\n${BOLD}STEP 5: Vehicle Availability at Location B${RESET}`);
  log(`Querying when vehicle can be used at Location B on ${tomorrow}…`);

  const avail = await getVehicleAvailabilityAtLocation(vehicleId, locB, tomorrow);

  log(`\n  Vehicle state:        ${YELLOW}${avail.vehicleState}${RESET}`);
  log(`  Current location:     ${avail.currentLocationName}`);
  log(`  Transit needed:       ${avail.transitMinutes != null ? `${avail.transitMinutes} min (${avail.distanceKm} km)` : 'No'}`);
  log(`  Available from:       ${GREEN}${avail.availableFrom}${RESET}`);
  if (avail.nextDriveEndsAt) log(`  Prev drive ends at:   ${avail.nextDriveEndsAt}`);

  // ─── STEP 6: Fleet overview ───────────────────────────────────────────────
  log(`\n${BOLD}STEP 6: Fleet Overview${RESET}`);
  const fleet = await getFleetOverview();
  const sharedVehicle = fleet.find((v: any) => v.id === vehicleId);

  if (sharedVehicle) {
    log(`\n  ${BOLD}${sharedVehicle.brand} ${sharedVehicle.model}${RESET}`);
    log(`  is_shared:         ${GREEN}${sharedVehicle.is_shared}${RESET}`);
    log(`  transit_status:    ${sharedVehicle.transit_status}`);
    log(`  current_location:  ${sharedVehicle.current_location?.name}`);
    log(`  upcoming_drives:   ${sharedVehicle.upcoming_drives.length}`);
    log(`  active_transits:   ${sharedVehicle.active_transits.length}`);
  }

  // ─── STEP 7: Summary & next steps ─────────────────────────────────────────
  log(`\n${BOLD}═══ Test Data Ready ═══${RESET}`);
  log(`\n${BOLD}IDs to use in browser tests:${RESET}`);
  log(`  Vehicle ID:     ${YELLOW}${vehicleId}${RESET}`);
  log(`  Location A ID:  ${YELLOW}${locA}${RESET}`);
  log(`  Location B ID:  ${YELLOW}${locB}${RESET}`);
  log(`  Drive 1 ID:     ${YELLOW}${td1Id}${RESET}  (today, Location A)`);
  log(`  Drive 2 ID:     ${YELLOW}${td2Id}${RESET}  (tomorrow, Location B)`);

  log(`\n${BOLD}Manual test steps (in browser):${RESET}`);
  log(`  1. Login → go to /fleet`);
  log(`     → Vehicle should appear with transit_status: at_location`);
  log(`  2. Go to /test-drives → find Drive 1 (today, ${today})`);
  log(`     → Click '...' dropdown → Mark Key Handover (or set status=completed)`);
  log(`     → Auto-transit fires: vehicle should move toward Location B`);
  log(`  3. Refresh /fleet`);
  log(`     → Transit card should appear: Location A → Location B`);
  log(`     → Shows distance + ETA from OSRM`);
  log(`  4. Click "Dispatch Now" → status = in_transit`);
  log(`  5. Click "Mark Arrived" → vehicle.current_location_id = Location B`);
  log(`  6. Check slot availability API:`);
  log(`     curl "http://localhost:4000/api/fleet/vehicles/${vehicleId}/availability?location_id=${locB}&date=${tomorrow}" -H "Authorization: Bearer <token>"`);

  await mongoose.disconnect();
  ok('\nDone!\n');
}

run().catch((err) => { console.error(err); process.exit(1); });
