import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Car, Clock, User, Timer } from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'Waiting', color: 'text-info', bgColor: 'bg-info/10 border-info/20' },
  confirmed: { label: 'Confirmed', color: 'text-primary', bgColor: 'bg-primary/10 border-primary/20' },
  show: { label: 'Checked In', color: 'text-success', bgColor: 'bg-success/10 border-success/20' },
  in_progress: { label: 'On Drive', color: 'text-accent-foreground', bgColor: 'bg-accent/10 border-accent/20' },
};

const WaitingBoardPage = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('location');
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [locationName, setLocationName] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      setNow(new Date());
    }, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [locationId]);

  const fetchData = async () => {
    let query = supabase.from('test_drives')
      .select('*, customers(full_name), vehicles(brand, model), profiles!test_drives_assigned_sales_person_id_fkey(full_name), locations(name)')
      .eq('scheduled_date', format(new Date(), 'yyyy-MM-dd'))
      .in('status', ['scheduled', 'confirmed', 'show', 'in_progress'])
      .order('scheduled_time', { ascending: true });

    if (locationId) query = query.eq('location_id', locationId);
    const { data } = await query;
    setTestDrives(data || []);
    if (data?.[0]?.locations?.name) setLocationName(data[0].locations.name);
  };

  const getETA = (td: any) => {
    if (td.status === 'in_progress' && td.started_at) {
      const elapsed = differenceInMinutes(now, parseISO(td.started_at));
      const remaining = Math.max(0, 30 - elapsed); // assume 30min drive
      return remaining > 0 ? `~${remaining} min` : 'Returning';
    }
    const [h, m] = (td.scheduled_time || '00:00').split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);
    const diff = differenceInMinutes(scheduled, now);
    if (diff <= 0) return 'Now';
    return `In ${diff} min`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Test Drive Status</h1>
              {locationName && <p className="text-muted-foreground">{locationName}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-heading font-bold text-foreground">{format(now, 'HH:mm')}</p>
            <p className="text-sm text-muted-foreground">{format(now, 'EEEE, MMM d')}</p>
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="max-w-7xl mx-auto p-8">
        {testDrives.length === 0 ? (
          <div className="text-center py-24">
            <Car className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-xl text-muted-foreground">No test drives scheduled right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {testDrives.map((td, index) => {
              const cfg = statusConfig[td.status] || statusConfig.scheduled;
              return (
                <div
                  key={td.id}
                  className={`rounded-xl border-2 p-6 transition-all ${cfg.bgColor}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center text-lg font-heading font-bold text-foreground">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-lg text-foreground">{td.customers?.full_name}</p>
                        <Badge variant="secondary" className={`${cfg.color} mt-1`}>{cfg.label}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{td.vehicles?.brand} {td.vehicles?.model}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{td.profiles?.full_name || 'Assigning...'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{td.scheduled_time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span className={`font-semibold ${cfg.color}`}>{getETA(td)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default WaitingBoardPage;
