import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestDriveDetailSheet } from './TestDriveDetailSheet';

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/components/TestDriveDocuments', () => ({
  TestDriveDocuments: ({ onLicenseUploaded }: { onLicenseUploaded: (path: string) => void }) => (
    <button onClick={() => onLicenseUploaded('licenses/customer-1/upload.pdf')}>Upload test license</button>
  ),
}));

describe('test drive detail actions and documents', () => {
  afterEach(cleanup);

  it.each(['key_assigned', 'show'])('shows handed keys as Key Assigned rather than %s in details', (status) => {
    render(<TestDriveDetailSheet testDrive={{ id: 'drive-1', status, key_handed_at: '2026-01-01T10:00:00Z' }} open onClose={vi.fn()} />);
    expect(screen.getByText('Key Assigned')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Security Start')).toBeInTheDocument();
  });

  it('shows role actions above customer details and uploads', () => {
    render(<TestDriveDetailSheet testDrive={{ id: 'drive-1', status: 'scheduled' }} open onClose={vi.fn()} actions={<button>Assign Key</button>} />);
    const actions = screen.getByText('Available Actions');
    const documents = screen.getByText('Documents');
    expect(actions.compareDocumentPosition(documents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Assign Key' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload test license' })).toBeInTheDocument();
  });

  it('shows a newly uploaded license as pending and accepts subsequent verification from refreshed data', () => {
    const drive = { id: 'drive-1', status: 'scheduled', customers: { driving_license_url: '', driving_license_verified: false } };
    const { rerender } = render(<TestDriveDetailSheet testDrive={drive} open onClose={vi.fn()} />);
    expect(screen.getByText('Not Uploaded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload test license' }));
    expect(screen.getByText('Pending Verification')).toBeInTheDocument();
    rerender(<TestDriveDetailSheet testDrive={{ ...drive, customers: { driving_license_url: 'licenses/customer-1/upload.pdf', driving_license_verified: true } }} open onClose={vi.fn()} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });
});
