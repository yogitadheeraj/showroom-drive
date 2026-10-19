import { describe, expect, it } from 'vitest';
import { getTestDriveStatus, getTestDriveStatusLabel } from './testDriveStatus';
import { buildTestDriveStatusCounts } from './dashboardMetrics';

describe('test drive key assignment stage', () => {
  it.each(['scheduled', 'confirmed', 'rescheduled', 'show', 'key_assigned'])('shows %s with handed keys as Key Assigned until Security starts', (status) => {
    const drive = { status, key_handed_at: '2026-01-01T10:00:00Z' };
    expect(getTestDriveStatus(drive)).toBe('key_assigned');
    expect(getTestDriveStatusLabel(drive)).toBe('Key Assigned');
  });

  it('does not treat arrival as key assignment or key assignment as a started drive', () => {
    expect(getTestDriveStatus({ status: 'show' })).toBe('show');
    expect(getTestDriveStatus({ status: 'key_assigned' })).not.toBe('in_progress');
    expect(getTestDriveStatus({ status: 'in_progress', key_handed_at: 'key', security_checked_in_at: 'start' })).toBe('in_progress');
  });

  it.each(['completed', 'cancelled', 'no_show', 'key_handover_to_sales', 'in_progress'])('preserves %s even with handed keys', (status) => {
    expect(getTestDriveStatus({ status, key_handed_at: 'key' })).toBe(status);
  });

  it('counts explicit and legacy key assignments in their own dashboard bucket', () => {
    const counts = buildTestDriveStatusCounts([
      { status: 'show' },
      { status: 'show', key_handed_at: 'key' },
      { status: 'key_assigned' },
    ]);
    expect(counts.show).toBe(1);
    expect(counts.key_assigned).toBe(2);
  });
});
