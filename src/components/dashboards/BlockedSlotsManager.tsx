import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  type LocationBlockedSlot,
  type BlockedSlotWithConflicts,
  listLocationBlockedSlots,
  createLocationBlockedSlot,
  deleteLocationBlockedSlot,
  cancelConflictsForBlockedSlot,
} from '@/lib/locationBlockedSlotService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarIcon, Plus, Trash2, Clock, ShieldAlert } from 'lucide-react';
import { format, isBefore, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BlockedSlotsManager = () => {
  const { profile } = useAuth();
  const [slots, setSlots] = useState<LocationBlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('19:00');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflictDialog, setConflictDialog] = useState<{
    slotId: string;
    count: number;
    cancelling: boolean;
  } | null>(null);

  const locationId = profile?.location_id;

  useEffect(() => {
    if (locationId) fetchSlots();
  }, [locationId]);

  const fetchSlots = async () => {
    setLoading(true);
    const today = format(startOfToday(), 'yyyy-MM-dd');
    const data = await listLocationBlockedSlots({
      location_id: locationId!,
      from_date: today,
    });
    setSlots(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newDate || !locationId) return;
    if (newStart >= newEnd) {
      toast.error('End time must be after start time');
      return;
    }
    setSaving(true);
    try {
      const result = await createLocationBlockedSlot({
        location_id: locationId,
        blocked_date: format(newDate, 'yyyy-MM-dd'),
        start_time: newStart,
        end_time: newEnd,
        reason: newReason.trim() || null,
        block_source: 'manual',
      });
      setDialogOpen(false);
      resetForm();
      void fetchSlots();
      if (result?.affected_bookings && result.affected_bookings.length > 0) {
        setConflictDialog({ slotId: result.id, count: result.affected_bookings.length, cancelling: false });
      } else {
        toast.success('Time slot blocked');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to block slot');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelConflicts = async () => {
    if (!conflictDialog) return;
    setConflictDialog(prev => prev ? { ...prev, cancelling: true } : null);
    try {
      const result = await cancelConflictsForBlockedSlot(conflictDialog.slotId);
      toast.success(`${result?.cancelled?.length ?? 0} conflicting booking(s) cancelled`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel conflicts');
    } finally {
      setConflictDialog(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocationBlockedSlot(id);
      toast.success('Slot unblocked');
      void fetchSlots();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to unblock slot');
    }
  };

  const resetForm = () => {
    setNewDate(undefined);
    setNewStart('09:00');
    setNewEnd('19:00');
    setNewReason('');
  };

  // Group slots by date
  const grouped = slots.reduce<Record<string, LocationBlockedSlot[]>>((acc, s) => {
    (acc[s.blocked_date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <h3 className="font-heading font-semibold text-foreground">Blocked Time Slots</h3>
          </div>
          <Button size="sm" className="rounded-xl" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Block Slot
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No blocked slots. All times are available for booking.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, dateSlots]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {format(new Date(date + 'T00:00'), 'EEEE, dd MMM yyyy')}
                </p>
                <div className="space-y-2">
                  {dateSlots.map(slot => (
                    <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-warning" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                          </p>
                          {slot.reason && (
                            <p className="text-xs text-muted-foreground">{slot.reason}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-warning/5 text-warning border-warning/20">
                          {slot.block_source}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Block a Time Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal rounded-xl", !newDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={(d) => { setNewDate(d); setDateOpen(false); }}
                    disabled={(d) => isBefore(d, startOfToday())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Start Time</label>
                <Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">End Time</label>
                <Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Reason (optional)</label>
              <Textarea
                placeholder="e.g. Showroom closed for event"
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                className="rounded-xl"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button className="gradient-primary border-0 text-primary-foreground rounded-xl" onClick={handleAdd} disabled={saving || !newDate}>
              {saving ? 'Blocking…' : 'Block Slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Warning Dialog */}
      <Dialog open={!!conflictDialog} onOpenChange={open => { if (!open && !conflictDialog?.cancelling) setConflictDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-warning">Booking Conflicts Detected</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{conflictDialog?.count}</strong> active test drive{conflictDialog?.count !== 1 ? 's are' : ' is'} already booked
            in this blocked window. Do you want to cancel them now?
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setConflictDialog(null)} disabled={conflictDialog?.cancelling}>
              Keep Bookings
            </Button>
            <Button
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelConflicts}
              disabled={conflictDialog?.cancelling}
            >
              {conflictDialog?.cancelling ? 'Cancelling…' : `Cancel ${conflictDialog?.count} Booking(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BlockedSlotsManager;
