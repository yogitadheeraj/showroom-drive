import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { apiDbQuery, apiGet, apiPatch } from '@/lib/apiClient';
import TodayView from './TodayView';

const auth = vi.hoisted(() => ({ role: 'gro' }));
vi.mock('@/lib/apiClient', () => ({ apiGet: vi.fn(), apiDbQuery: vi.fn(), apiPatch: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { id: 'gro-1', location_id: 'location-1' }, role: auth.role }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useTestDriveRealtime', () => ({ useTestDriveRealtime: vi.fn() }));
vi.mock('@/components/WalkinDialog', () => ({ default: () => null }));
vi.mock('@/components/public/CarConfiguratorExperience', () => ({ default: () => null }));
vi.mock('@/components/dashboards/Customer360Sheet', () => ({ default: () => null }));
vi.mock('@/components/TestDriveDetailSheet', () => ({
  TestDriveDetailSheet: ({ open, actions }: { open: boolean; actions: ReactNode }) => open ? <div data-testid="detail-actions">{actions}</div> : null,
}));

describe('Today view booking workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.role = 'gro';
    vi.mocked(apiDbQuery).mockResolvedValue([]);
  });
  afterEach(cleanup);

  it.each(['scheduled', 'rescheduled'])('allows GRO to confirm a %s booking and mark arrival without starting the drive', async (status) => {
    const drive = {
      id: 'drive-1',
      status,
      scheduled_date: new Date().toLocaleDateString('en-CA'),
      scheduled_time: '10:00:00',
      customers: { full_name: 'Workflow Customer' },
    };
    vi.mocked(apiGet).mockImplementation(async () => [drive]);
    vi.mocked(apiPatch).mockImplementation(async (_url, payload) => {
      Object.assign(drive, payload);
      return drive;
    });
    render(<TodayView />);
    fireEvent.click(await screen.findByRole('button', { name: /Test drive$/i }));
    const details = within(screen.getByTestId('detail-actions'));
    expect(details.getByRole('button', { name: 'Mark no-show' })).toBeInTheDocument();
    expect(details.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.click(details.getByRole('button', { name: 'Confirm booking' }));
    await waitFor(() => expect(drive.status).toBe('confirmed'));
    await waitFor(() => expect(within(screen.getByTestId('detail-actions')).getByRole('button', { name: 'Mark arrived' })).toBeEnabled());
    fireEvent.click(within(screen.getByTestId('detail-actions')).getByRole('button', { name: 'Mark arrived' }));
    await waitFor(() => expect(drive.status).toBe('show'));
    await waitFor(() => expect(within(screen.getByTestId('detail-actions')).getByText(/Security completes inspection and starts the drive/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Start drive' })).not.toBeInTheDocument();
  });

  it('keeps rescheduled bookings visible in the Upcoming bucket', async () => {
    vi.mocked(apiGet).mockResolvedValue([{
      id: 'rescheduled-1',
      status: 'rescheduled',
      scheduled_date: new Date().toLocaleDateString('en-CA'),
      scheduled_time: '10:00:00',
      customers: { full_name: 'Upcoming Customer' },
    }]);
    render(<TodayView />);
    fireEvent.click(await screen.findByRole('button', { name: '1 Upcoming' }));
    expect(screen.getByRole('button', { name: /Test drive$/i })).toBeInTheDocument();
    expect(screen.getAllByText('Rescheduled').length).toBeGreaterThan(0);
  });

  it.each([true, false])('shows Sales key assignment only when license verification is %s', async (verified) => {
    auth.role = 'sales';
    vi.mocked(apiGet).mockResolvedValue([{
      id: 'sales-drive',
      status: 'rescheduled',
      scheduled_date: new Date().toLocaleDateString('en-CA'),
      scheduled_time: '10:00:00',
      customers: { full_name: 'Sales Customer', driving_license_verified: verified },
    }]);
    render(<TodayView />);
    fireEvent.click(await screen.findByRole('button', { name: /Test drive$/i }));
    const details = within(screen.getByTestId('detail-actions'));
    expect(Boolean(details.queryByRole('button', { name: 'Assign Key' }))).toBe(verified);
    expect(details.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Assign Key' })).toHaveLength(verified ? 2 : 0);
  });

  it('persists Key Assigned without starting the drive and refreshes the card and detail actions', async () => {
    auth.role = 'sales';
    const drive = {
      id: 'sales-drive', status: 'show',
      scheduled_date: new Date().toLocaleDateString('en-CA'), scheduled_time: '10:00:00',
      customers: { full_name: 'Sales Customer', driving_license_verified: true },
    };
    vi.mocked(apiGet).mockImplementation(async () => [drive]);
    vi.mocked(apiPatch).mockImplementation(async (_url, payload) => {
      Object.assign(drive, payload);
      return drive;
    });
    render(<TodayView />);
    fireEvent.click(await screen.findByRole('button', { name: /Test drive$/i }));
    fireEvent.click(within(screen.getByTestId('detail-actions')).getByRole('button', { name: 'Assign Key' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/api/test-drives/sales-drive', {
      key_handed_at: expect.any(String), status: 'key_assigned',
    }));
    await waitFor(() => expect(screen.getAllByText(/awaiting Security inspection and start/i)).toHaveLength(2));
    expect(drive.status).toBe('key_assigned');
    expect(screen.queryByRole('button', { name: 'Assign Key' })).not.toBeInTheDocument();
  });
});
