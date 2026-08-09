import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Car, Activity, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Counts {
  testDrives: {
    all: number;
    scheduled: number;
    confirmed: number;
    show: number;
    in_progress: number;
    completed: number;
    no_show: number;
    cancelled: number;
    rescheduled: number;
  };
  staffEvents: number;
  openTasks: number;
  activeSessions: number;
}

const GROUPS = [
  { key: 'testDrives' as const, label: 'Test Drives Today', icon: Car, color: 'text-info', bg: 'bg-info/10' },
  { key: 'testDrivesTotal' as const, label: 'Total Test Drives Today', icon: Car, color: 'text-info', bg: 'bg-info/10' },
 
  { key: 'staffEvents' as const, label: 'Staff Events Today', icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'openTasks' as const, label: 'Open Follow-ups', icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
  { key: 'activeSessions' as const, label: 'Active Sessions', icon: Users, color: 'text-success', bg: 'bg-success/10' },
];

const TEST_DRIVE_STATUS_LABELS: Array<{ key: keyof Counts['testDrives']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'show', label: 'Show' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'no_show', label: 'No show' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'rescheduled', label: 'Rescheduled' },
];

export function ActivityInsightsMini() {
  const { loading: authLoading } = useAuth();
  const [counts, setCounts] = useState<Counts>({
    testDrives: { all: 0, scheduled: 0, confirmed: 0, show: 0, in_progress: 0, completed: 0, no_show: 0, cancelled: 0, rescheduled: 0 },
    staffEvents: 0,
    openTasks: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) void fetchCounts();
  }, [authLoading]);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const data = await apiGet<Counts>('/api/activity/insights');
      setCounts(data || {
        testDrives: { all: 0, scheduled: 0, confirmed: 0, show: 0, in_progress: 0, completed: 0, no_show: 0, cancelled: 0, rescheduled: 0 },
        staffEvents: 0,
        openTasks: 0,
        activeSessions: 0,
      });
    } catch {
      setCounts({
        testDrives: { all: 0, scheduled: 0, confirmed: 0, show: 0, in_progress: 0, completed: 0, no_show: 0, cancelled: 0, rescheduled: 0 },
        staffEvents: 0,
        openTasks: 0,
        activeSessions: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" /> Activity Insights
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void fetchCounts()}>
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {GROUPS.map(g => {
            const Icon = g.icon;
            const isTestDriveGroup = g.key === 'testDrives';
            return (
              <div
                key={g.key}
                className={`rounded-2xl border p-3 shadow-sm ${isTestDriveGroup ? 'col-span-12 lg:col-span-12' : ''} ${g.bg} border-border/60`}
              >
                <div className={`flex items-center gap-2.5 ${isTestDriveGroup ? 'mb-2' : ''}`}>
                  <div className={`rounded-xl p-2 ${isTestDriveGroup ? 'bg-info/15' : 'bg-background/70'}`}>
                    <Icon className={`h-5 w-5 ${g.color} shrink-0`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground leading-tight uppercase tracking-wide">{g.label}</p>
                    <p className="text-2xl font-bold text-foreground leading-tight">
                      {loading ? '—' : isTestDriveGroup || g.key === 'testDrivesTotal' ? counts.testDrives.all : counts[g.key]}
                    </p>
                  </div>
                </div>
                {isTestDriveGroup && !loading && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {TEST_DRIVE_STATUS_LABELS.map((status) => (
                      <div key={status.key} className="rounded-xl border border-border/60 bg-background/80 px-2.5 py-2 shadow-sm">
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-none">{status.label}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground leading-none">{counts.testDrives[status.key]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
