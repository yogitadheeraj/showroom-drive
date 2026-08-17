import { useEffect, useState } from 'react';
import { apiDbQuery } from '@/lib/apiClient';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { Badge } from '@/components/ui/badge';
import { Car, Clock, User, Timer } from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import useBrowserSearchParams from '@/hooks/useBrowserSearchParams';

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'Waiting', color: 'text-info', bgColor: 'bg-info/10 border-info/20' },
  confirmed: { label: 'Confirmed', color: 'text-primary', bgColor: 'bg-primary/10 border-primary/20' },
  show: { label: 'Checked In', color: 'text-success', bgColor: 'bg-success/10 border-success/20' },
  in_progress: { label: 'On Drive', color: 'text-black-foreground', bgColor: 'bg-accent/10 border-accent/20' },
};

const animationStyles = `
  /* Rainbow & Gradient Animations */
  @keyframes rainbow-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes rainbow-text {
    0% { color: #ff0000; }
    16% { color: #ff7f00; }
    33% { color: #ffff00; }
    50% { color: #00ff00; }
    66% { color: #0000ff; }
    83% { color: #4b0082; }
    100% { color: #ff0000; }
  }
  
  /* Scale & Pulse Animations */
  @keyframes pulse-scale {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
  }
  @keyframes bounce-scale {
    0%, 100% { transform: scale(1) translateY(0); }
    50% { transform: scale(1.08) translateY(-8px); }
  }
  @keyframes heartbeat {
    0%, 100% { transform: scale(1); }
    14% { transform: scale(1.15); }
    28% { transform: scale(1); }
    42% { transform: scale(1.15); }
    56% { transform: scale(1); }
  }
  
  /* Glow Animations */
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    50% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
  }
  @keyframes glow-green {
    0%, 100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5), 0 0 0 0 rgba(34, 197, 94, 0.7); }
    50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.8), 0 0 25px rgba(34, 197, 94, 0); }
  }
  @keyframes glow-yellow {
    0%, 100% { box-shadow: 0 0 5px rgba(234, 179, 8, 0.5), 0 0 0 0 rgba(234, 179, 8, 0.7); }
    50% { box-shadow: 0 0 20px rgba(234, 179, 8, 0.8), 0 0 25px rgba(234, 179, 8, 0); }
  }
  @keyframes glow-purple {
    0%, 100% { box-shadow: 0 0 5px rgba(168, 85, 247, 0.5), 0 0 0 0 rgba(168, 85, 247, 0.7); }
    50% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.8), 0 0 25px rgba(168, 85, 247, 0); }
  }
  
  /* Rotation & Spin Animations */
  @keyframes spin-slow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes wobble {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-2deg); }
    75% { transform: rotate(2deg); }
  }
  
  /* Slide & Fade Animations */
  @keyframes slide-in-top {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes slide-in-left {
    from { transform: translateX(-50px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fade-in-scale {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  
  /* Blink & Flash */
  @keyframes blink {
    0%, 49%, 100% { opacity: 1; }
    50%, 99% { opacity: 0.6; }
  }
  @keyframes flash {
    0%, 50%, 100% { opacity: 1; }
    25% { opacity: 0.3; }
    75% { opacity: 0.7; }
  }
  
  /* Class Definitions */
  .animate-pulse-scale { animation: pulse-scale 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  .animate-bounce-scale { animation: bounce-scale 1.5s ease-in-out infinite; }
  .animate-heartbeat { animation: heartbeat 1.3s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 2s infinite; }
  .animate-glow-green { animation: glow-green 2s infinite; }
  .animate-glow-yellow { animation: glow-yellow 2s infinite; }
  .animate-glow-purple { animation: glow-purple 2s infinite; }
  .animate-spin-slow { animation: spin-slow 4s linear infinite; }
  .animate-wobble { animation: wobble 0.8s ease-in-out infinite; }
  .animate-slide-in { animation: slide-in-top 0.5s ease-out; }
  .animate-slide-in-left { animation: slide-in-left 0.6s ease-out; }
  .animate-fade-in-scale { animation: fade-in-scale 0.6s ease-out; }
  .animate-blink { animation: blink 1.5s ease-in-out infinite; }
  .animate-flash { animation: flash 1.2s ease-in-out infinite; }
  .animate-rainbow-text { animation: rainbow-text 3s ease-in-out infinite; }
  
  /* Rainbow Background Gradient */
  .rainbow-bg {
    background: linear-gradient(-45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);
    background-size: 400% 400%;
  }
  .animate-rainbow-shift { animation: rainbow-shift 4s ease infinite; }
`;

const WaitingBoardPage = () => {
  const [searchParams] = useBrowserSearchParams();
  const locationId = searchParams.get('location');
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [locationName, setLocationName] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    fetchData();

    // Update clock every second for real-time timer
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, [locationId]);

  useTestDriveRealtime(locationId, () => {
    void fetchData();
  });

  const fetchData = async () => {
    const filters: Array<{ field: string; op: 'eq' | 'in'; value: unknown }> = [
      { field: 'status', op: 'in', value: ['scheduled', 'confirmed', 'show', 'in_progress'] },
    ];
    if (locationId) {
      filters.push({ field: 'location_id', op: 'eq', value: locationId });
    }

    const drives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: '*',
      filters,
      order: [{ field: 'scheduled_time', ascending: true }],
    });

    const customerIds = Array.from(new Set((drives || []).map((d) => d.customer_id).filter(Boolean)));
    const vehicleIds = Array.from(new Set((drives || []).map((d) => d.vehicle_id).filter(Boolean)));
    const salesProfileIds = Array.from(new Set((drives || []).map((d) => d.assigned_sales_person_id).filter(Boolean)));
    const locationIds = Array.from(new Set((drives || []).map((d) => d.location_id).filter(Boolean)));

    const [customers, vehicles, profiles, locations] = await Promise.all([
      customerIds.length
        ? apiDbQuery<any[]>({
            table: 'customers',
            action: 'select',
            select: 'id, full_name',
            filters: [{ field: 'id', op: 'in', value: customerIds }],
          })
        : Promise.resolve([]),
      vehicleIds.length
        ? apiDbQuery<any[]>({
            table: 'vehicles',
            action: 'select',
            select: 'id, brand, model',
            filters: [{ field: 'id', op: 'in', value: vehicleIds }],
          })
        : Promise.resolve([]),
      salesProfileIds.length
        ? apiDbQuery<any[]>({
            table: 'profiles',
            action: 'select',
            select: 'id, full_name',
            filters: [{ field: 'id', op: 'in', value: salesProfileIds }],
          })
        : Promise.resolve([]),
      locationIds.length
        ? apiDbQuery<any[]>({
            table: 'locations',
            action: 'select',
            select: 'id, name',
            filters: [{ field: 'id', op: 'in', value: locationIds }],
          })
        : Promise.resolve([]),
    ]);

    const customerMap = (customers || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const vehicleMap = (vehicles || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const profileMap = (profiles || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const locationMap = (locations || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});

    const hydrated = (drives || []).map((drive: any) => ({
      ...drive,
      customers: customerMap[drive.customer_id] || null,
      vehicles: vehicleMap[drive.vehicle_id] || null,
      profiles: profileMap[drive.assigned_sales_person_id] || null,
      locations: locationMap[drive.location_id] || null,
    }));

    setTestDrives(hydrated);
    if (hydrated?.[0]?.locations?.name) setLocationName(hydrated[0].locations.name);
  };

  const today = now ? format(now, 'yyyy-MM-dd') : null;
  const todaysDrives = today
    ? testDrives.filter((drive) => drive.scheduled_date === today)
    : [];
  const upcomingDrives = today
    ? testDrives.filter((drive) => drive.scheduled_date !== today)
    : testDrives;

  const getETA = (td: any) => {
    if (!now) return 'Calculating...';

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

  const getCarColor = (status: string): { bg: string; color: string } => {
    switch (status) {
      case 'scheduled':
        return { bg: 'bg-blue-100', color: 'text-blue-600' };
      case 'confirmed':
        return { bg: 'bg-purple-100', color: 'text-purple-600' };
      case 'show':
        return { bg: 'bg-green-100', color: 'text-green-600' };
      case 'in_progress':
        return { bg: 'bg-orange-100', color: 'text-orange-600' };
      default:
        return { bg: 'bg-gray-100', color: 'text-gray-600' };
    }
  };

  const currentTimeLabel = now ? format(now, 'HH:mm') : '--:--';
  const currentDateLabel = now ? format(now, 'EEEE, MMM d') : 'Loading date';

  return (
    <div className="min-h-screen bg-background">
      <style>{animationStyles}</style>
      {/* Header */}
      <header className="bg-card border-b border-2 border-border px-4 sm:px-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg gradient-primary flex items-center justify-center">
              <Car className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-heading font-bold text-foreground">Test Drive Status</h1>
              {locationName && <p className="text-xs sm:text-base text-muted-foreground">{locationName}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl sm:text-6xl font-heading font-bold text-primary" style={{ letterSpacing: '0.05em' }}>
              {currentTimeLabel}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">{currentDateLabel}</p>
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8">
        {testDrives.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <Car className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base sm:text-xl text-muted-foreground">No active test drives found</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-foreground">Today&apos;s board</h2>
                <Badge variant="secondary">{todaysDrives.length} drives</Badge>
              </div>
              {todaysDrives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No test drives scheduled today. Showing upcoming active drives below.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {todaysDrives.map((td, index) => {
                    const cfg = statusConfig[td.status] || statusConfig.scheduled;
                    const isOnDrive = td.status === 'in_progress';

                    return (
                      <div
                        key={td.id}
                        className={`rounded-lg border-2 p-6 transition-all ${cfg.bgColor}`}
                        style={{
                          borderColor: isOnDrive ? '#ff7f00' : 'inherit',
                          borderWidth: isOnDrive ? '3px' : '2px',
                        }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center text-lg font-heading font-bold text-foreground">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-heading font-semibold text-lg text-foreground">{td.customers?.full_name}</p>
                              <div className={`${cfg.color} mt-1 font-heading font-bold text-2xl sm:text-3xl`}>
                                {cfg.label}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            {(() => {
                              const carColor = getCarColor(td.status);
                              return (
                                <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-all border-2 ${carColor.bg} border-current ${
                                  isOnDrive
                                    ? `${carColor.color} animate-spin-slow`
                                    : carColor.color
                                }`}>
                                  <Car className={`h-8 w-8 ${carColor.color}`} />
                                </div>
                              );
                            })()}
                            <span className="text-foreground font-medium">{td.vehicles?.brand} {td.vehicles?.model}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className={`h-4 w-4 ${td.profiles?.full_name ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            <div className="flex items-center gap-2 flex-1">
                              <span className={`font-medium ${td.profiles?.full_name ? 'text-blue-600 font-bold' : 'text-foreground'}`}>
                                {td.profiles?.full_name || 'Assigning...'}
                              </span>
                              {td.profiles?.full_name && (
                                <div className="flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded-full">
                                  <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
                                  <span className="text-xs font-semibold text-blue-600">Driving</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground font-medium">{td.scheduled_time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-lg sm:text-2xl font-heading font-bold">
                            <Timer className={`h-6 w-6 ${isOnDrive ? 'text-orange-600 animate-spin-slow' : cfg.color}`} />
                            <span className={`${isOnDrive ? 'text-orange-600 animate-pulse' : cfg.color}`}>
                              {getETA(td)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {upcomingDrives.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">Upcoming active drives</h2>
                  <Badge variant="outline">{upcomingDrives.length} drives</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {upcomingDrives.map((td, index) => {
              const cfg = statusConfig[td.status] || statusConfig.scheduled;
              const isOnDrive = td.status === 'in_progress';

              return (
                <div
                  key={td.id}
                  className={`rounded-lg border-2 p-6 transition-all ${cfg.bgColor}`}
                  style={{
                    borderColor: isOnDrive ? '#ff7f00' : 'inherit',
                    borderWidth: isOnDrive ? '3px' : '2px',
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center text-lg font-heading font-bold text-foreground">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-lg text-foreground">{td.customers?.full_name}</p>
                        <div className={`${cfg.color} mt-1 font-heading font-bold text-2xl sm:text-3xl`}>
                          {cfg.label}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      {(() => {
                        const carColor = getCarColor(td.status);
                        return (
                          <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-all border-2 ${carColor.bg} border-current ${
                            isOnDrive 
                              ? `${carColor.color} animate-spin-slow` 
                              : carColor.color
                          }`}>
                            <Car className={`h-8 w-8 ${carColor.color}`} />
                          </div>
                        );
                      })()}
                      <span className="text-foreground font-medium">{td.vehicles?.brand} {td.vehicles?.model}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className={`h-4 w-4 ${td.profiles?.full_name ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`font-medium ${td.profiles?.full_name ? 'text-blue-600 font-bold' : 'text-foreground'}`}>
                          {td.profiles?.full_name || 'Assigning...'}
                        </span>
                        {td.profiles?.full_name && (
                          <div className="flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded-full">
                            <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
                            <span className="text-xs font-semibold text-blue-600">Driving</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium">{td.scheduled_time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-lg sm:text-2xl font-heading font-bold">
                      <Timer className={`h-6 w-6 ${isOnDrive ? 'text-orange-600 animate-spin-slow' : cfg.color}`} />
                      <span className={`${isOnDrive ? 'text-orange-600 animate-pulse' : cfg.color}`}>
                        {getETA(td)}
                      </span>
                    </div>
                  </div>
                </div>
              );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default WaitingBoardPage;
