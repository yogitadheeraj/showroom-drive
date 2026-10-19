import { describe, expect, it } from 'vitest';
import { TestDrive } from './TestDrive.js';

describe('test drive workflow statuses', () => {
  it.each(['key_assigned', 'in_progress', 'key_handover_to_sales'])('accepts the persisted %s workflow stage', (status) => {
    const drive = new TestDrive({
      id: 'drive-1', customer_id: 'customer-1', vehicle_id: 'vehicle-1', location_id: 'location-1',
      scheduled_date: '2026-01-01', scheduled_time: '10:00', status,
    });
    expect(drive.validateSync()).toBeUndefined();
    expect(drive.status).toBe(status);
  });
});
