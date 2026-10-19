import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VehicleInspectionDialog from './VehicleInspectionDialog';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: {}, role: 'security' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/activityLogger', () => ({ logStaffActivity: vi.fn() }));

describe('vehicle inspection identity', () => {
  afterEach(cleanup);

  it.each(['pre', 'post'] as const)('shows vehicle details in the %s-drive form', (type) => {
    render(<VehicleInspectionDialog open onClose={vi.fn()} onComplete={vi.fn()} type={type} testDrive={{
      id: 'drive-1',
      vehicles: { year: 2025, brand: 'Example', model: 'Tourer', variant: 'Sport', registration_number: 'ABC 123', color: 'Blue', vin: 'VIN123' },
    }} />);
    expect(screen.getByText('2025 Example Tourer Sport')).toBeInTheDocument();
    expect(screen.getByText(/Registration: ABC 123/)).toHaveTextContent('Color: Blue');
    expect(screen.getByText('VIN: VIN123')).toBeInTheDocument();
  });

  it('explicitly identifies unavailable vehicle details rather than showing a blank card', () => {
    render(<VehicleInspectionDialog open onClose={vi.fn()} onComplete={vi.fn()} type="pre" testDrive={{ id: 'drive-1' }} />);
    expect(screen.getByText('Vehicle details unavailable')).toBeInTheDocument();
    expect(screen.getByText('Registration: Not recorded')).toBeInTheDocument();
  });
});
