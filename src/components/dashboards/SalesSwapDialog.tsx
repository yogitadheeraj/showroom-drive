import { useState, useEffect } from 'react';
import { apiDbQuery } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { logStaffActivity } from '@/lib/activityLogger';

type AssignmentMode = 'reassign' | 'swap';

interface SalesSwapDialogProps {
  open: boolean;
  onClose: () => void;
  testDrive: any;
  onSwapped: () => void;
  mode?: AssignmentMode;
}

const SalesSwapDialog = ({ open, onClose, testDrive, onSwapped, mode = 'swap' }: SalesSwapDialogProps) => {
  const { profile } = useAuth();
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [targetPersonId, setTargetPersonId] = useState('');
  const [targetDriveId, setTargetDriveId] = useState('');
  const [targetPersonDrives, setTargetPersonDrives] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && profile?.location_id) fetchSalesTeam();
  }, [open, profile]);

  useEffect(() => {
    setTargetDriveId('');
    if (mode === 'swap' && open && targetPersonId) {
      fetchTargetDrives(targetPersonId);
    } else {
      setTargetPersonDrives([]);
    }
  }, [mode, open, targetPersonId]);

  const fetchSalesTeam = async () => {
    const rolesData = await apiDbQuery<any[]>({
      table: 'user_roles',
      action: 'select',
      select: 'user_id',
      filters: [{ field: 'role', op: 'eq', value: 'sales' }],
    });
    if (!rolesData?.length) return;
    const userIds = rolesData.map(r => r.user_id);
    const data = await apiDbQuery<any[]>({
      table: 'profiles',
      action: 'select',
      select: 'id, full_name, user_id',
      filters: [
        { field: 'location_id', op: 'eq', value: profile.location_id },
        { field: 'is_active', op: 'eq', value: true },
        { field: 'user_id', op: 'in', value: userIds },
      ],
    });

    setSalesPersons((data || []).filter(sp => sp.id !== profile.id));
  };

  const fetchTargetDrives = async (personId: string) => {
    const drives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: '*',
      filters: [
        { field: 'assigned_sales_person_id', op: 'eq', value: personId },
        { field: 'status', op: 'in', value: ['scheduled', 'confirmed', 'show'] },
      ],
      order: [{ field: 'scheduled_date', ascending: true }],
    });

    const customerIds = Array.from(new Set((drives || []).map((d: any) => d.customer_id).filter(Boolean)));
    const vehicleIds = Array.from(new Set((drives || []).map((d: any) => d.vehicle_id).filter(Boolean)));

    const [customers, vehicles] = await Promise.all([
      customerIds.length ? apiDbQuery<any[]>({ table: 'customers', action: 'select', select: 'id, full_name', filters: [{ field: 'id', op: 'in', value: customerIds }] }) : Promise.resolve([]),
      vehicleIds.length ? apiDbQuery<any[]>({ table: 'vehicles', action: 'select', select: 'id, brand, model', filters: [{ field: 'id', op: 'in', value: vehicleIds }] }) : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const enriched = (drives || [])
      .map((d) => ({
        ...d,
        customers: customerMap.get(d.customer_id) || null,
        vehicles: vehicleMap.get(d.vehicle_id) || null,
      }))
      .filter(d => d.id !== testDrive?.id);

    setTargetPersonDrives(enriched);
  };

  const appendAssignmentNote = (baseNotes: string | null | undefined, note: string) => {
    const line = `[${new Date().toLocaleString()}] ${note}`;
    return baseNotes ? `${baseNotes}\n${line}` : line;
  };

  const handleReassign = async () => {
    if (!targetPersonId || !testDrive?.id) return;

    const targetName = salesPersons.find(s => s.id === targetPersonId)?.full_name || 'Unknown';
    const note = `Reassigned from ${profile?.full_name || 'Unknown'} to ${targetName}${comment ? `: ${comment}` : ''}`;

    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: {
        assigned_sales_person_id: targetPersonId,
        notes: appendAssignmentNote(testDrive.notes, note),
      },
      filters: [{ field: 'id', op: 'eq', value: testDrive.id }],
    });

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'sales',
        eventType: 'test_drive_reassigned',
        label: 'Reassigned test drive to another sales person',
        metadata: { testDriveId: testDrive.id, targetPersonId },
      });
    }
  };

  const handleSwap = async () => {
    if (!targetPersonId || !targetDriveId || !testDrive?.id) return;

    const sourceDriveId = testDrive.id;
    const sourcePersonId = profile?.id;
    if (!sourcePersonId) throw new Error('Profile not loaded');

    const targetDrives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: 'id, assigned_sales_person_id, notes',
      filters: [{ field: 'id', op: 'eq', value: targetDriveId }],
      limit: 1,
    });

    const targetDrive = targetDrives?.[0] || null;
    if (!targetDrive?.assigned_sales_person_id) {
      throw new Error('Target drive not available for swap');
    }

    const targetName = salesPersons.find(s => s.id === targetPersonId)?.full_name || 'Unknown';

    const sourceNote = `Swapped with ${targetName}${comment ? `: ${comment}` : ''}`;
    const targetNote = `Swapped with ${profile?.full_name || 'Unknown'}${comment ? `: ${comment}` : ''}`;

    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: {
        assigned_sales_person_id: targetPersonId,
        notes: appendAssignmentNote(testDrive.notes, sourceNote),
      },
      filters: [{ field: 'id', op: 'eq', value: sourceDriveId }],
    });

    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: {
        assigned_sales_person_id: sourcePersonId,
        notes: appendAssignmentNote(targetDrive.notes, targetNote),
      },
      filters: [{ field: 'id', op: 'eq', value: targetDriveId }],
    });

    if (profile?.user_id) {
      await logStaffActivity({
        userId: profile.user_id,
        profileId: profile.id,
        locationId: profile.location_id,
        role: 'sales',
        eventType: 'test_drive_swapped',
        label: 'Swapped test drives with another sales person',
        metadata: { sourceDriveId, targetDriveId, targetPersonId },
      });
    }
  };

  const handleConfirm = async () => {
    if (!targetPersonId || !testDrive?.id) return;

    if (mode === 'swap' && !targetDriveId) return;

    setLoading(true);
    try {
      if (mode === 'reassign') {
        await handleReassign();
        toast({ title: 'Test drive reassigned successfully' });
      } else {
        await handleSwap();
        toast({ title: 'Test drives swapped successfully' });
      }

      setTargetPersonId('');
      setTargetDriveId('');
      setComment('');
      onSwapped();
      onClose();
    } catch (err: any) {
      toast({ title: mode === 'reassign' ? 'Reassign failed' : 'Swap failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const dialogTitle = mode === 'reassign' ? 'Reassign Test Drive' : 'Swap Test Drive';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium text-foreground">{testDrive?.customers?.full_name}</p>
            <p className="text-muted-foreground">{testDrive?.vehicles?.brand} {testDrive?.vehicles?.model} • {testDrive?.scheduled_date} at {testDrive?.scheduled_time}</p>
          </div>

          <div className="space-y-2">
            <Label>{mode === 'reassign' ? 'Reassign to' : 'Swap with'}</Label>
            <Select value={targetPersonId} onValueChange={setTargetPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {salesPersons.map(sp => (
                  <SelectItem key={sp.id} value={sp.id}>{sp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'swap' && (
            <div className="space-y-2">
              <Label>Target Drive</Label>
              <Select value={targetDriveId} onValueChange={setTargetDriveId} disabled={!targetPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder={targetPersonId ? 'Select target drive' : 'Select team member first'} />
                </SelectTrigger>
                <SelectContent>
                  {targetPersonDrives.map(td => (
                    <SelectItem key={td.id} value={td.id}>
                      {td.customers?.full_name} • {td.vehicles?.brand} {td.vehicles?.model} • {td.scheduled_date} {td.scheduled_time?.substring(0, 5)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={mode === 'reassign' ? 'Reason for reassignment...' : 'Reason for swap...'}
              rows={3}
            />
          </div>

          <Button onClick={handleConfirm} className="w-full" disabled={!targetPersonId || (mode === 'swap' && !targetDriveId) || loading}>
            {loading ? (mode === 'reassign' ? 'Reassigning...' : 'Swapping...') : (mode === 'reassign' ? 'Confirm Reassign' : 'Confirm Swap')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesSwapDialog;
