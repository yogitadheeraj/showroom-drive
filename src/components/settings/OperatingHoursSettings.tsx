import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDealerContext } from '@/hooks/useDealerContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader, Clock, MapPin } from 'lucide-react';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface HoursForm {
  id?: string;
  location_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const OperatingHoursSettings = () => {
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [hoursData, setHoursData] = useState<HoursForm[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

  useEffect(() => {
    if (!dealerId || dealerLoading) return;
    const fetch = async () => {
      // Fetch locations
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name')
        .eq('dealer_id', dealerId)
        .order('name');

      if (locs) {
        setLocations(locs);
        if (locs.length > 0) setExpandedLocation(locs[0].id);

        // Fetch operating hours
        const { data: hours } = await supabase
          .from('location_operating_hours')
          .select('*')
          .in(
            'location_id',
            locs.map(l => l.id)
          );

        if (hours) {
          // Ensure all location+day combinations exist
          const hoursMap = new Map<string, HoursForm>();
          hours.forEach(h => {
            hoursMap.set(`${h.location_id}-${h.day_of_week}`, {
              id: h.id,
              location_id: h.location_id,
              day_of_week: h.day_of_week,
              open_time: h.open_time || '09:00:00',
              close_time: h.close_time || '18:00:00',
              is_closed: h.is_closed || false,
            });
          });

          // Add missing day combinations
          const allHours: HoursForm[] = [];
          locs.forEach(loc => {
            DAYS.forEach(day => {
              const key = `${loc.id}-${day.value}`;
              if (hoursMap.has(key)) {
                allHours.push(hoursMap.get(key)!);
              } else {
                allHours.push({
                  location_id: loc.id,
                  day_of_week: day.value,
                  open_time: '09:00:00',
                  close_time: '18:00:00',
                  is_closed: false,
                });
              }
            });
          });

          setHoursData(allHours);
        }
      }
      setLoading(false);
    };
    fetch();
  }, [dealerId, dealerLoading]);

  const updateHours = (index: number, field: keyof HoursForm, value: any) => {
    setHoursData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveHours = async (hours: HoursForm) => {
    setSavingId(`${hours.location_id}-${hours.day_of_week}`);
    try {
      const [openH, openM] = hours.open_time.split(':').map(Number);
      const [closeH, closeM] = hours.close_time.split(':').map(Number);

      if (!hours.is_closed) {
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;
        if (closeMinutes <= openMinutes) {
          throw new Error('Close time must be after open time');
        }
      }

      // Ensure time format is HH:MM:SS (remove any existing seconds first)
      const formatTime = (time: string) => {
        const parts = time.split(':');
        return `${parts[0]}:${parts[1]}:00`;
      };

      if (hours.id) {
        await supabase
          .from('location_operating_hours')
          .update({
            open_time: formatTime(hours.open_time),
            close_time: formatTime(hours.close_time),
            is_closed: hours.is_closed,
          })
          .eq('id', hours.id);
      } else {
        const { data: inserted, error } = await supabase
          .from('location_operating_hours')
          .insert({
            location_id: hours.location_id,
            day_of_week: hours.day_of_week,
            open_time: formatTime(hours.open_time),
            close_time: formatTime(hours.close_time),
            is_closed: hours.is_closed,
          })
          .select('id');

        if (error) throw error;
        if (inserted && inserted[0]) {
          const updatedData = hoursData.map(h =>
            h.location_id === hours.location_id && h.day_of_week === hours.day_of_week
              ? { ...h, id: inserted[0].id }
              : h
          );
          setHoursData(updatedData);
        }
      }

      toast({ title: 'Hours saved', description: `${DAYS.find(d => d.value === hours.day_of_week)?.label} hours updated` });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  if (dealerLoading || loading) {
    return <div className="text-muted-foreground animate-pulse p-8 flex items-center gap-2"><Loader className="h-4 w-4 animate-spin" /> Loading...</div>;
  }

  if (locations.length === 0) {
    return (
      <Card className="shadow-elevated">
        <CardContent className="py-12 text-center text-muted-foreground">
          No locations found. Add locations from the onboarding flow first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {locations.map(location => {
        const locHours = hoursData.filter(h => h.location_id === location.id);
        const isExpanded = expandedLocation === location.id;

        return (
          <Card key={location.id} className="shadow-elevated overflow-hidden">
            <button
              onClick={() => setExpandedLocation(isExpanded ? null : location.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground">{location.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {locHours.filter(h => !h.is_closed).length} days open
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {locHours.filter(h => !h.is_closed).length}/{DAYS.length}
              </Badge>
            </button>

            {isExpanded && (
              <CardContent className="border-t border-border pt-5 space-y-4">
                <div className="space-y-3">
                  {locHours.map((hours, idx) => {
                    const dayLabel = DAYS.find(d => d.value === hours.day_of_week)?.label;
                    const fullIdx = hoursData.indexOf(hours);

                    return (
                      <div
                        key={`${hours.location_id}-${hours.day_of_week}`}
                        className="p-4 rounded-lg border border-border space-y-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold text-sm text-foreground">{dayLabel}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={hours.is_closed}
                              onChange={e => updateHours(fullIdx, 'is_closed', e.target.checked)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <Label className="text-xs text-muted-foreground cursor-pointer">Closed</Label>
                          </div>
                        </div>

                        {!hours.is_closed && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Opens</Label>
                              <Input
                                type="time"
                                value={hours.open_time.substring(0, 5)}
                                onChange={e => updateHours(fullIdx, 'open_time', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Closes</Label>
                              <Input
                                type="time"
                                value={hours.close_time.substring(0, 5)}
                                onChange={e => updateHours(fullIdx, 'close_time', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={() => handleSaveHours(hours)}
                          disabled={savingId === `${hours.location_id}-${hours.day_of_week}`}
                          size="sm"
                          className="w-full gradient-primary border-0 text-primary-foreground gap-2 text-xs"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {savingId === `${hours.location_id}-${hours.day_of_week}` ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default OperatingHoursSettings;
