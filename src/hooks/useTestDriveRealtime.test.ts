import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDriveRealtime } from './useTestDriveRealtime';

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(),
  onValue: mocks.subscribe,
}));

describe('test drive realtime stages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  });
  afterEach(cleanup);

  it('skips existing events, emits the changed drive, and unsubscribes', () => {
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useTestDriveRealtime('location-1', onUpdate));
    const emit = (events: object[]) => act(() => mocks.subscribe.mock.calls[0][1]({
      forEach: (visit: (child: { val: () => object }) => void) => events.forEach((event) => visit({ val: () => event })),
    }));
    const first = { test_drive_id: 'old-drive', status: 'show', location_id: 'location-1', updated_at: 'first' };
    const second = { test_drive_id: 'drive-1', status: 'show', location_id: 'location-1', updated_at: 'first' };
    emit([first, second]);
    expect(onUpdate).not.toHaveBeenCalled();
    emit([first, { ...second, status: 'key_assigned', updated_at: 'second' }]);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ test_drive_id: 'drive-1', status: 'key_assigned' }));
    emit([first, { ...second, status: 'in_progress', updated_at: 'third' }]);
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ test_drive_id: 'drive-1', status: 'in_progress' }));
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
