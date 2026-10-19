import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { APP_ROLE } from '@/constants/roles';
import { apiPatch } from '@/lib/apiClient';
import { getStorageSignedUrl, listStorageFiles, uploadToStorage } from '@/lib/storageClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logStaffActivity } from '@/lib/activityLogger';

interface Props {
  drive: {
    id: string;
    customer_id?: string;
    status: string;
    scheduled_date?: string;
    customers?: { driving_license_url?: string; driving_license_verified?: boolean };
  };
  onLicenseUploaded: (path: string) => void;
  onChanged?: () => void;
}

export function TestDriveDocuments({ drive, onLicenseUploaded, onChanged }: Props) {
  const { role, profile } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<Array<{ name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = ['scheduled', 'confirmed', 'rescheduled', 'show', 'key_assigned', 'in_progress', 'key_handover_to_sales'].includes(drive.status);
  const canUpload = active &&
    ([APP_ROLE.SALES, APP_ROLE.GRO, APP_ROLE.SECURITY, APP_ROLE.SALES_ADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SUPERADMIN] as string[]).includes(role || '') &&
    (role !== APP_ROLE.SECURITY || drive.scheduled_date === new Date().toLocaleDateString('en-CA'));

  useEffect(() => {
    let cancelled = false;
    setFiles([]);
    listStorageFiles('documents', `test-drives/${drive.id}`).then((rows) => {
      if (!cancelled) setFiles(rows || []);
    }).catch((error: unknown) => {
      if (!cancelled) toast({ title: 'Could not load documents', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    });
    return () => { cancelled = true; };
  }, [drive.id, revision, toast]);

  const upload = async (file: File, license: boolean) => {
    const customerId = drive.customer_id;
    if (!canUpload || (license && (!customerId || drive.customers?.driving_license_verified))) {
      toast({ title: 'Upload unavailable', description: 'Uploads are not allowed for this role, date, or status.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
        throw new Error('Only JPG, PNG, WEBP, or PDF files are allowed');
      }
      if (file.size > (license ? 5 : 10) * 1024 * 1024) {
        throw new Error(`File size must be ${license ? 5 : 10}MB or less`);
      }
      const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1];
      const path = `${license ? `licenses/${drive.customer_id}` : `test-drives/${drive.id}`}/${crypto.randomUUID()}.${extension}`;
      await uploadToStorage('documents', path, file);
      if (license && customerId) {
        await apiPatch(`/api/customers/${encodeURIComponent(customerId)}`, {
          driving_license_url: path,
          driving_license_verified: false,
        });
        onLicenseUploaded(path);
      }
      setRevision((value) => value + 1);
      onChanged?.();
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id,
          profileId: profile.id,
          locationId: profile.location_id,
          role,
          eventType: 'license_uploaded',
          label: license ? 'Uploaded customer driving license' : 'Uploaded test drive document',
          metadata: { testDriveId: drive.id, customerId, path },
        }).catch((error: unknown) => {
          console.error('Document saved but activity logging failed', error);
          toast({ title: 'Document saved, but activity log failed', variant: 'destructive' });
        });
      }
      toast({ title: license ? 'License uploaded for verification' : 'Document uploaded' });
    } catch (error) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const view = async (path: string) => {
    try {
      const url = /^https?:\/\//i.test(path) ? path : await getStorageSignedUrl('documents', path, 300);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({ title: 'Could not open document', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      {drive.customers?.driving_license_url && (
        <Button size="sm" variant="outline" onClick={() => { if (drive.customers?.driving_license_url) void view(drive.customers.driving_license_url); }}>
          View driving license
        </Button>
      )}
      {canUpload ? (
        <>
          {drive.customer_id && !drive.customers?.driving_license_verified && (
            <div className="space-y-1">
              <Label htmlFor={`detail-license-${drive.id}`}>{drive.customers?.driving_license_url ? 'Re-upload driving license' : 'Upload driving license'}</Label>
              <Input id={`detail-license-${drive.id}`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy}
                onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, true); }} />
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or PDF, up to 5MB. Security verifies the license before the drive.</p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`detail-document-${drive.id}`}>Upload supporting document</Label>
            <Input id={`detail-document-${drive.id}`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy}
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, false); }} />
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or PDF, up to 10MB.</p>
          </div>
        </>
      ) : <p className="text-xs text-muted-foreground">Documents are view-only. Uploads require an active booking; Security uploads are available only on the scheduled day.</p>}
      {busy && <p role="status" className="text-xs text-muted-foreground">Uploading...</p>}
      {files.map((file) => (
        <Button key={file.name} variant="outline" size="sm" className="w-full justify-start truncate" onClick={() => void view(`test-drives/${drive.id}/${file.name}`)}>
          {file.name}
        </Button>
      ))}
    </div>
  );
}
