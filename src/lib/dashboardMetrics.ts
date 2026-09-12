type StatusRow = { status?: string | null };

export const TEST_DRIVE_STATUS_BUCKETS = {
  scheduled: 0,
  confirmed: 0,
  show: 0,
  in_progress: 0,
  completed: 0,
  no_show: 0,
  cancelled: 0,
  rescheduled: 0,
} as const;

export const SERVICE_BOOKING_STATUS_BUCKETS = {
  booked: 0,
  confirmed: 0,
  in_progress: 0,
  ready_for_delivery: 0,
  completed: 0,
  cancelled: 0,
  rescheduled: 0,
} as const;

export function buildTestDriveStatusCounts(rows: StatusRow[] = []) {
  const counts = { ...TEST_DRIVE_STATUS_BUCKETS };

  for (const row of rows) {
    const status = String(row?.status ?? '').trim();
    if (!(status in counts)) continue;
    counts[status as keyof typeof counts] += 1;
  }

  return counts;
}

export function buildServiceBookingStatusCounts(rows: StatusRow[] = []) {
  const counts = { ...SERVICE_BOOKING_STATUS_BUCKETS };

  for (const row of rows) {
    const status = String(row?.status ?? '').trim();
    if (!(status in counts)) continue;
    counts[status as keyof typeof counts] += 1;
  }

  return counts;
}
