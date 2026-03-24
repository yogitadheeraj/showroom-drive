import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SalesSwapDialogProps {
  open: boolean;
  onClose: () => void;
  testDrive: any;
  onSwapped: () => void;
}

const SalesSwapDialog = ({ open, onClose, testDrive, onSwapped }: SalesSwapDialogProps) => {
  const { profile } = useAuth();
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [targetPersonId, setTargetPersonId] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && profile?.location_id) fetchSalesTeam();
  }, [open, profile]);

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

  const handleSwap = async () => {
    if (!targetPersonId || !testDrive?.id) return;
    setLoading(true);
    try {
      const swapNote = `Swapped from ${profile?.full_name} to ${salesPersons.find(s => s.id === targetPersonId)?.full_name}${comment ? `: ${comment}` : ''}`;
      const existingNotes = testDrive.notes || '';
      const updatedNotes = existingNotes
        ? `${existingNotes}\n[${new Date().toLocaleString()}] ${swapNote}`
        : `[${new Date().toLocaleString()}] ${swapNote}`;

      await supabase.from('test_drives')
        .update({
          assigned_sales_person_id: targetPersonId,
          notes: updatedNotes,
        })
        .eq('id', testDrive.id);

      toast({ title: 'Booking swapped successfully' });
      setTargetPersonId('');
      setComment('');
      onSwapped();
      onClose();
    } catch (err: any) {
      toast({ title: 'Swap failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Swap Test Drive</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium text-foreground">{testDrive?.customers?.full_name}</p>
            <p className="text-muted-foreground">{testDrive?.vehicles?.brand} {testDrive?.vehicles?.model} • {testDrive?.scheduled_date} at {testDrive?.scheduled_time}</p>
          </div>
          <div className="space-y-2">
            <Label>Transfer to</Label>
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
          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Reason for swap..."
              rows={3}
            />
          </div>
          <Button onClick={handleSwap} className="w-full" disabled={!targetPersonId || loading}>
            {loading ? 'Swapping...' : 'Confirm Swap'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesSwapDialog;
