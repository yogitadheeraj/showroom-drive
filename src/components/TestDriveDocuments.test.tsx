import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestDriveDocuments } from './TestDriveDocuments';
import { apiPatch } from '@/lib/apiClient';
import { listStorageFiles, uploadToStorage } from '@/lib/storageClient';

const mocks = vi.hoisted(() => ({ role: 'sales', toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/apiClient', () => ({ apiPatch: vi.fn() }));
vi.mock('@/lib/storageClient', () => ({
  listStorageFiles: vi.fn(),
  uploadToStorage: vi.fn(),
  getStorageSignedUrl: vi.fn(),
}));

const activeDrive = {
  id: 'drive-1',
  customer_id: 'customer-1',
  status: 'rescheduled',
  scheduled_date: new Date().toLocaleDateString('en-CA'),
  customers: { driving_license_verified: false },
};

describe('test drive detail documents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'sales';
    vi.mocked(listStorageFiles).mockResolvedValue([]);
  });
  afterEach(cleanup);

  it('allows supporting uploads while the key is assigned and Security start is pending', async () => {
    render(<TestDriveDocuments drive={{ ...activeDrive, status: 'key_assigned' }} onLicenseUploaded={vi.fn()} />);
    expect(screen.getByLabelText('Upload supporting document')).toBeInTheDocument();
    await waitFor(() => expect(listStorageFiles).toHaveBeenCalled());
  });

  it.each(['sales', 'gro', 'security'])('allows %s to upload missing documents on active bookings today', async (role) => {
    mocks.role = role;
    render(<TestDriveDocuments drive={activeDrive} onLicenseUploaded={vi.fn()} />);
    expect(screen.getByLabelText('Upload driving license')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload supporting document')).toBeInTheDocument();
    await waitFor(() => expect(listStorageFiles).toHaveBeenCalledWith('documents', 'test-drives/drive-1'));
  });

  it.each(['completed', 'cancelled', 'no_show'])('keeps %s documents read-only', async (status) => {
    render(<TestDriveDocuments drive={{ ...activeDrive, status }} onLicenseUploaded={vi.fn()} />);
    expect(screen.queryByLabelText('Upload supporting document')).not.toBeInTheDocument();
    expect(await screen.findByText(/Documents are view-only/)).toBeInTheDocument();
  });

  it.each(['2020-01-01', '2099-01-01'])('keeps Security uploads disabled for %s', async (date) => {
    mocks.role = 'security';
    render(<TestDriveDocuments drive={{ ...activeDrive, scheduled_date: date }} onLicenseUploaded={vi.fn()} />);
    expect(screen.queryByLabelText('Upload driving license')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upload supporting document')).not.toBeInTheDocument();
    await waitFor(() => expect(listStorageFiles).toHaveBeenCalled());
  });

  it('does not allow unrelated roles to upload', async () => {
    mocks.role = 'service_expert';
    render(<TestDriveDocuments drive={activeDrive} onLicenseUploaded={vi.fn()} />);
    expect(screen.queryByLabelText('Upload supporting document')).not.toBeInTheDocument();
    await waitFor(() => expect(listStorageFiles).toHaveBeenCalled());
  });

  it('persists a missing license and requires verification before key assignment', async () => {
    const onLicenseUploaded = vi.fn();
    const onChanged = vi.fn();
    render(<TestDriveDocuments drive={activeDrive} onLicenseUploaded={onLicenseUploaded} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText('Upload driving license'), { target: { files: [new File(['license'], 'license.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/api/customers/customer-1', {
      driving_license_url: expect.stringMatching(/^licenses\/customer-1\/.+\.pdf$/),
      driving_license_verified: false,
    }));
    expect(onLicenseUploaded).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it('uses the existing test-drive document storage folder', async () => {
    render(<TestDriveDocuments drive={activeDrive} onLicenseUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Upload supporting document'), { target: { files: [new File(['document'], 'document.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(uploadToStorage).toHaveBeenCalledWith('documents', expect.stringMatching(/^test-drives\/drive-1\/.+\.pdf$/), expect.any(File)));
    expect(apiPatch).not.toHaveBeenCalled();
  });

  it('hides replacement for verified licenses without hiding supporting uploads', async () => {
    render(<TestDriveDocuments drive={{ ...activeDrive, customers: { driving_license_verified: true } }} onLicenseUploaded={vi.fn()} />);
    expect(screen.queryByLabelText('Upload driving license')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Upload supporting document')).toBeInTheDocument();
    await waitFor(() => expect(listStorageFiles).toHaveBeenCalled());
  });

  it('rejects unsupported files explicitly', async () => {
    render(<TestDriveDocuments drive={activeDrive} onLicenseUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Upload supporting document'), { target: { files: [new File(['bad'], 'file.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', variant: 'destructive' })));
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('surfaces storage failure without claiming success or updating the customer', async () => {
    vi.mocked(uploadToStorage).mockRejectedValue(new Error('Storage unavailable'));
    render(<TestDriveDocuments drive={activeDrive} onLicenseUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Upload driving license'), { target: { files: [new File(['license'], 'license.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'Storage unavailable' })));
    expect(apiPatch).not.toHaveBeenCalled();
  });
});
