import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { ClipboardCheck, Car } from 'lucide-react';

interface VehicleInspectionDialogProps {
  open: boolean;
  onClose: () => void;
  testDrive: any;
  type: 'pre' | 'post';
  onComplete: () => void;
}

const FUEL_LEVELS = ['Full', '3/4', '1/2', '1/4', 'Empty'];

const VehicleInspectionDialog = ({ open, onClose, testDrive, type, onComplete }: VehicleInspectionDialogProps) => {
  const { toast } = useToast();
  const [km, setKm] = useState('');
  const [scratches, setScratches] = useState('');
  const [notes, setNotes] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPre = type === 'pre';
  const title = isPre ? 'Pre-Drive Vehicle Inspection' : 'Post-Drive Vehicle Inspection';
  const description = isPre
    ? 'Record the vehicle condition before the test drive begins'
    : 'Record the vehicle condition after the test drive is completed';

  const handleSubmit = async () => {
    if (!km) {
      toast({ title: 'Odometer reading is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const updateData: Record<string, any> = isPre
        ? {
            pre_drive_km: parseFloat(km),
            pre_drive_scratches: scratches || null,
            pre_drive_notes: notes || null,
            pre_drive_fuel_level: fuelLevel || null,
          }
        : {
            post_drive_km: parseFloat(km),
            post_drive_scratches: scratches || null,
            post_drive_notes: notes || null,
            post_drive_fuel_level: fuelLevel || null,
            inspection_submitted_at: new Date().toISOString(),
          };

      await supabase.from('test_drives').update(updateData as any).eq('id', testDrive.id);
      toast({ title: `${isPre ? 'Pre' : 'Post'}-drive inspection saved` });
      setKm('');
      setScratches('');
      setNotes('');
      setFuelLevel('');
      onClose();
      onComplete();
    } catch (err: any) {
      toast({ title: 'Failed to save inspection', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!testDrive) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-3 flex items-center gap-3">
          <Car className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm text-foreground">
              {testDrive.vehicles?.brand} {testDrive.vehicles?.model}
            </p>
            <p className="text-xs text-muted-foreground">
              {testDrive.vehicles?.registration_number} • {testDrive.vehicles?.color}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Odometer Reading (km) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              placeholder="e.g. 12500"
              value={km}
              onChange={e => setKm(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Fuel / Battery Level</Label>
            <Select value={fuelLevel} onValueChange={setFuelLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {FUEL_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scratches / Damage</Label>
            <Textarea
              placeholder="Describe any existing scratches, dents, or damage..."
              value={scratches}
              onChange={e => setScratches(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Any other observations..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <ClipboardCheck className="h-4 w-4 mr-1" />
            {submitting ? 'Saving...' : 'Submit Inspection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleInspectionDialog;
