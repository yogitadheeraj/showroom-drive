import { useEffect, useRef } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

export type TestDriveRealtimeEvent = {
  test_drive_id: string;
  status: string;
  customer_name: string;
  vehicle_name: string;
  location_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  updated_at: string;
};

/**
 * Listens to RTDB `test_drive_events/{locationId}` for real-time status
 * changes. Skips the initial snapshot on mount so that `onUpdate` is only
 * called for new events that arrive while the page is open.
 */
export function useTestDriveRealtime(
  locationId: string | null | undefined,
  onUpdate: (event: TestDriveRealtimeEvent) => void,
) {
  // Stable ref so the effect closure never captures a stale onUpdate
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  useEffect(() => {
    if (!locationId) return;

    let db: ReturnType<typeof getDatabase>;
    try {
      db = getDatabase();
    } catch {
      // Firebase not configured in this environment
      return;
    }

    const dbRef = ref(db, `test_drive_events/${locationId}`);
    let isFirst = true;
    let previous = new Map<string, string>();

    const unsub = onValue(
      dbRef,
      (snap) => {
        const next = new Map<string, string>();
        snap.forEach((child) => {
          const event: unknown = child.val();
          if (!event || typeof event !== 'object' ||
              !('test_drive_id' in event) || typeof event.test_drive_id !== 'string' ||
              !('status' in event) || typeof event.status !== 'string' ||
              !('location_id' in event) || typeof event.location_id !== 'string' ||
              !('updated_at' in event) || typeof event.updated_at !== 'string') return;
          const fingerprint = JSON.stringify(event);
          next.set(event.test_drive_id, fingerprint);
          if (!isFirst && previous.get(event.test_drive_id) !== fingerprint) {
            onUpdateRef.current({
              test_drive_id: event.test_drive_id,
              status: event.status,
              location_id: event.location_id,
              updated_at: event.updated_at,
              customer_name: 'customer_name' in event && typeof event.customer_name === 'string' ? event.customer_name : '',
              vehicle_name: 'vehicle_name' in event && typeof event.vehicle_name === 'string' ? event.vehicle_name : '',
              scheduled_date: 'scheduled_date' in event && typeof event.scheduled_date === 'string' ? event.scheduled_date : null,
              scheduled_time: 'scheduled_time' in event && typeof event.scheduled_time === 'string' ? event.scheduled_time : null,
            });
          }
        });
        previous = next;
        isFirst = false;
      },
      () => {
        // Silence RTDB permission / offline errors
      },
    );

    return () => unsub();
  }, [locationId]);
}
