import { useEffect, useRef } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

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
 * Listens to Firestore `test_drive_events/{locationId}` for real-time status
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

    let db: ReturnType<typeof getFirestore>;
    try {
      db = getFirestore();
    } catch {
      // Firebase not configured in this environment
      return;
    }

    const docRef = doc(db, 'test_drive_events', locationId);
    let isFirst = true;

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (isFirst) {
          isFirst = false;
          return; // skip initial snapshot — we already loaded the page
        }
        if (!snap.exists()) return;
        onUpdateRef.current(snap.data() as TestDriveRealtimeEvent);
      },
      () => {
        // Silence Firestore permission / offline errors
      },
    );

    return () => unsub();
  }, [locationId]);
}
