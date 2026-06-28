import { useState, useEffect } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery, apiPatch } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, MapPin, CalendarClock } from 'lucide-react';

const BookingSettings = ({ dealerIdOverride }: { dealerIdOverride?: string } = {}) => {
  const { dealerId: ctxDealerId, loading: dealerLoading } = useDealerContext();
  const dealerId = dealerIdOverride || ctxDealerId;
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const { toast } = useToast();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (dealerLoading || (!dealerId && !isSuperAdmin)) return;
    const load = async () => {
      setLoading(true);
      const filters: any[] = [];
      if (dealerId) filters.push({ field: 'dealer_id', op: 'eq', value: dealerId });
      filters.push({ field: 'is_active', op: 'eq', value: true });
      const rows = await apiDbQuery<any[]>({
        table: 'locations',
        action: 'select',
        select: 'id, name, public_booking_rate_limit_minutes',
        filters,
        order: [{ field: 'name', ascending: true }],
      }).catch(() => [] as any[]);
      setLocations(rows ?? []);
      const initial: Record<string, number> = {};
      (rows ?? []).forEach((loc: any) => {
        initial[loc.id] = typeof loc.public_booking_rate_limit_minutes === 'number'
          ? loc.public_booking_rate_limit_minutes
          : 10;
      });
      setForm(initial);
      setLoading(false);
    };
    void load();
  }, [dealerId, dealerLoading]);

  const handleSave = async (locationId: string) => {
    const value = form[locationId];
    if (!Number.isFinite(value) || value < 1) {
      toast({ title: 'Invalid value', description: 'Rate limit must be at least 1 minute.', variant: 'destructive' });
      return;
    }
    setSaving(prev => ({ ...prev, [locationId]: true }));
    try {
      await apiPatch(`/api/locations/${encodeURIComponent(locationId)}`, {
        public_booking_rate_limit_minutes: value,
      });
      toast({ title: 'Saved', description: 'Booking rate limit updated.' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(prev => ({ ...prev, [locationId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading locations…
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">No active locations found.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Public Booking Rate Limit
          </CardTitle>
          <CardDescription>
            Control how often an anonymous visitor can submit a test drive booking from the public booking page.
            After a booking is submitted, the same phone number must wait this many minutes before booking again.
          </CardDescription>
        </CardHeader>
      </Card>

      {locations.map(loc => (
        <Card key={loc.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> {loc.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 max-w-sm">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`rate-${loc.id}`}>Rate limit (minutes)</Label>
                <Input
                  id={`rate-${loc.id}`}
                  type="number"
                  min={1}
                  max={1440}
                  value={form[loc.id] ?? 10}
                  onChange={e =>
                    setForm(prev => ({ ...prev, [loc.id]: Number(e.target.value) }))
                  }
                  className="w-32"
                />
              </div>
              <Button
                onClick={() => handleSave(loc.id)}
                disabled={saving[loc.id]}
                size="sm"
                className="gap-2"
              >
                {saving[loc.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Currently set to <strong>{form[loc.id] ?? 10} minute{(form[loc.id] ?? 10) === 1 ? '' : 's'}</strong>.
              Set to <strong>1</strong> to allow one booking per minute (minimum).
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BookingSettings;
