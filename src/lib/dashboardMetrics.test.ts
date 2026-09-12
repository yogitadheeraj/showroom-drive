import { describe, expect, it } from 'vitest';
import { buildTestDriveStatusCounts, buildServiceBookingStatusCounts } from './dashboardMetrics';

describe('dashboardMetrics', () => {
  it('counts test drive statuses accurately including show and rescheduled', () => {
    const rows = [
      { status: 'scheduled' },
      { status: 'confirmed' },
      { status: 'show' },
      { status: 'show' },
      { status: 'in_progress' },
      { status: 'completed' },
      { status: 'no_show' },
      { status: 'cancelled' },
      { status: 'rescheduled' },
      { status: 'unknown_status' },
    ];

    expect(buildTestDriveStatusCounts(rows)).toEqual({
      scheduled: 1,
      confirmed: 1,
      show: 2,
      in_progress: 1,
      completed: 1,
      no_show: 1,
      cancelled: 1,
      rescheduled: 1,
    });
  });

  it('counts service booking statuses accurately and ignores unknown values', () => {
    const rows = [
      { status: 'booked' },
      { status: 'booked' },
      { status: 'confirmed' },
      { status: 'ready_for_delivery' },
      { status: 'completed' },
      { status: 'cancelled' },
      { status: 'unknown_status' },
    ];

    expect(buildServiceBookingStatusCounts(rows)).toEqual({
      booked: 2,
      confirmed: 1,
      in_progress: 0,
      ready_for_delivery: 1,
      completed: 1,
      cancelled: 1,
      rescheduled: 0,
    });
  });
});
