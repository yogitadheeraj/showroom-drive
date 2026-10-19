import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '@/lib/apiClient';
import SecurityDashboard from './SecurityDashboard';

const mocks = vi.hoisted(() => ({ profile: { id: 'security-1', location_id: 'location-1' } }));
vi.mock('@/lib/apiClient', () => ({ apiGet: vi.fn(), apiPatch: vi.fn() }));
vi.mock('@/lib/storageClient', () => ({
  listStorageFiles: vi.fn().mockResolvedValue([]), getStorageSignedUrl: vi.fn(), removeStorageFiles: vi.fn(), uploadToStorage: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: mocks.profile, role: 'security' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useTestDriveRealtime', () => ({ useTestDriveRealtime: vi.fn() }));
vi.mock('@/components/ActivityInsightsMini', () => ({ ActivityInsightsMini: () => null }));
vi.mock('@/components/IncomingVehiclesPanel', () => ({ default: () => null }));
vi.mock('@/components/TestDriveDetailSheet', () => ({ TestDriveDetailSheet: () => null }));
vi.mock('@/lib/activityLogger', () => ({ logStaffActivity: vi.fn() }));

describe('Security inspection report', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it.each([100, 0, null])('shows pre/post damage and multiline notes with odometer %s', async (km) => {
    vi.mocked(apiGet).mockImplementation(async (url) => url.startsWith('/api/test-drives?') ? [{
      id: 'drive-1', status: 'completed',
      scheduled_date: new Date().toLocaleDateString('en-CA'),
      vehicles: { brand: 'Example', model: 'Tourer', registration_number: 'ABC 123' },
      customers: { full_name: 'Inspection Customer', driving_license_verified: true },
      pre_drive_km: km, post_drive_km: km == null ? null : km + 10,
      pre_drive_scratches: 'Front bumper scratch', post_drive_scratches: 'Rear door dent',
      pre_drive_notes: 'Before departure\nCheck mirrors', post_drive_notes: 'After return\nCheck tires',
    }] : []);
    render(<SecurityDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));
    const report = within(screen.getByRole('dialog'));
    expect(report.getByText('Inspection Report')).toBeInTheDocument();
    expect(report.getAllByText('Scratches / Damage:')).toHaveLength(2);
    expect(report.getAllByText('Additional Notes:')).toHaveLength(2);
    expect(report.getByText(/Front bumper scratch/)).toBeInTheDocument();
    expect(report.getByText(/Rear door dent/)).toBeInTheDocument();
    expect(report.getByText(/Before departure/).textContent).toContain('Before departure\nCheck mirrors');
    expect(report.getByText(/After return/).textContent).toContain('After return\nCheck tires');
  });

  it('does not show empty damage or notes fields', async () => {
    vi.mocked(apiGet).mockImplementation(async (url) => url.startsWith('/api/test-drives?') ? [{
      id: 'drive-1', status: 'completed', scheduled_date: new Date().toLocaleDateString('en-CA'),
      pre_drive_km: 100, pre_drive_scratches: '  ', pre_drive_notes: null,
    }] : []);
    render(<SecurityDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));
    expect(within(screen.getByRole('dialog')).queryByText('Scratches / Damage:')).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText('Additional Notes:')).not.toBeInTheDocument();
  });
});
