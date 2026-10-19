import { beforeEach, describe, expect, it, vi } from 'vitest';

const records = vi.hoisted(() => ({
  find: vi.fn(), customers: vi.fn(), vehicles: vi.fn(), locations: vi.fn(), profiles: vi.fn(),
}));
vi.mock('../models/TestDrive.js', () => ({ TestDrive: { find: records.find } }));
vi.mock('../models/Customer.js', () => ({ Customer: { find: () => ({ lean: records.customers }) } }));
vi.mock('../models/Vehicle.js', () => ({ Vehicle: { find: (...args: unknown[]) => { records.vehicles(...args); return { lean: async () => [{
  id: 'vehicle-1', brand: 'Example', model: 'Tourer', variant: 'Sport', year: 2025, color: 'Blue', registration_number: 'ABC 123', vin: 'VIN123',
}] }; } } }));
vi.mock('../models/Location.js', () => ({ Location: { find: () => ({ lean: records.locations }) } }));
vi.mock('../models/Profile.js', () => ({ Profile: { find: () => ({ lean: records.profiles }) } }));
vi.mock('./mailService.js', () => ({ sendMail: vi.fn() }));
vi.mock('./firebaseService.js', () => ({ notifyTestDriveStatusChange: vi.fn() }));
vi.mock('./notificationDispatcherService.js', () => ({ dispatchNotification: vi.fn() }));
vi.mock('../controllers/customerBookingController.js', () => ({ generateBookingToken: vi.fn() }));
vi.mock('../config/env.js', () => ({ env: {} }));
vi.mock('./vehicleFleetService.js', () => ({ autoTransitAfterDrive: vi.fn() }));
vi.mock('./subscriptionPolicyService.js', () => ({ enforceDealerResourceLimit: vi.fn(), resolveDealerIdFromLocation: vi.fn() }));
vi.mock('./testDriveReminderService.js', () => ({ queueTestDriveCompletionEmail: vi.fn() }));

import { getTestDriveById, listTestDrives } from './testDriveService.js';

describe('inspection vehicle enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    records.customers.mockResolvedValue([]);
    records.locations.mockResolvedValue([]);
    records.profiles.mockResolvedValue([]);
  });

  const mockDrives = (drives: object[]) => {
    const query = Object.assign(Promise.resolve(drives), { limit: vi.fn() });
    records.find.mockReturnValue({ sort: () => ({ lean: () => query }) });
  };

  it('returns full vehicle identity for lists and fresh single-drive inspection reads', async () => {
    mockDrives([{ id: 'drive-1', vehicle_id: 'vehicle-1', pre_drive_scratches: 'Bumper scratch', post_drive_notes: 'Returned clean' }]);
    const [listed] = await listTestDrives();
    const single = await getTestDriveById('drive-1');
    for (const drive of [listed, single]) {
      expect(drive?.vehicles).toEqual(expect.objectContaining({
        brand: 'Example', model: 'Tourer', year: 2025, variant: 'Sport', registration_number: 'ABC 123', color: 'Blue', vin: 'VIN123',
      }));
      expect(drive?.pre_drive_scratches).toBe('Bumper scratch');
      expect(drive?.post_drive_notes).toBe('Returned clean');
    }
    expect(records.find).toHaveBeenLastCalledWith({ id: { $in: ['drive-1'] } });
    expect(records.vehicles).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ registration_number: 1, color: 1, year: 1, vin: 1 }));
  });

  it('returns null for a missing drive', async () => {
    mockDrives([]);
    expect(await getTestDriveById('missing-drive')).toBeNull();
    expect(records.vehicles).not.toHaveBeenCalled();
  });
});
