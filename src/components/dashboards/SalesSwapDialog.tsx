import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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
    const { data: rolesData } = await supabase.from('user_roles').select('user_id').eq('role', 'sales');
    if (!rolesData?.length) return;
    const userIds = rolesData.map(r => r.user_id);
    const { data } = await supabase.from('profiles')
      .select('id, full_name, user_id')
      .eq('location_id', profile.location_id)
      .eq('is_active', true)
      .in('user_id', userIds);

    setSalesPersons((data || []).filter(sp => sp.id !== profile.id));
  };

  const fetchTargetDrives = async (personId: string) => {
    const { data } = await supabase.from('test_drives')
      .select('id, scheduled_date, scheduled_time, status, customers(full_name), vehicles(brand, model)')
      .eq('assigned_sales_person_id', personId)
      .in('status', ['scheduled', 'confirmed', 'show'])
      .order('scheduled_date', { ascending: true });

    setTargetPersonDrives((data || []).filter(d => d.id !== testDrive?.id));
  };

  const appendAssignmentNote = (baseNotes: string | null | undefined, note: string) => {
    const line = `[${new Date().toLocaleString()}] ${note}`;
    return baseNotes ? `${baseNotes}\n${line}` : line;
  };

  const handleReassign = async () => {
    if (!targetPersonId || !testDrive?.id) return;

    const targetName = salesPersons.find(s => s.id === targetPersonId)?.full_name || 'Unknown';
    const note = `Reassigned from ${profile?.full_name || 'Unknown'} to ${targetName}${comment ? `: ${comment}` : ''}`;

    const { error } = await supabase.from('test_drives')
      .update({
        assigned_sales_person_id: targetPersonId,
        notes: appendAssignmentNote(testDrive.notes, note),
      })
      .eq('id', testDrive.id);

    if (error) throw error;
  };

  const handleSwap = async () => {
    if (!targetPersonId || !targetDriveId || !testDrive?.id) return;

    const sourceDriveId = testDrive.id;
    const sourcePersonId = profile?.id;
    if (!sourcePersonId) throw new Error('Profile not loaded');

    const { data: targetDrive, error: targetDriveError } = await supabase.from('test_drives')
      .select('id, assigned_sales_person_id, notes')
      .eq('id', targetDriveId)
      .maybeSingle();

    if (targetDriveError || !targetDrive?.assigned_sales_person_id) {
      throw new Error('Target drive not available for swap');
    }

    const targetName = salesPersons.find(s => s.id === targetPersonId)?.full_name || 'Unknown';

    const sourceNote = `Swapped with ${targetName}${comment ? `: ${comment}` : ''}`;
    const targetNote = `Swapped with ${profile?.full_name || 'Unknown'}${comment ? `: ${comment}` : ''}`;

    const { error: sourceError } = await supabase.from('test_drives')
      .update({
        assigned_sales_person_id: targetPersonId,
        notes: appendAssignmentNote(testDrive.notes, sourceNote),
      })
      .eq('id', sourceDriveId);

    if (sourceError) throw sourceError;

    const { error: targetError } = await supabase.from('test_drives')
      .update({
        assigned_sales_person_id: sourcePersonId,
        notes: appendAssignmentNote(targetDrive.notes, targetNote),
      })
      .eq('id', targetDriveId);

    if (targetError) throw targetError;
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
