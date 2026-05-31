import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery } from '@/lib/apiClient';
import { useTestDriveRealtime } from '@/hooks/useTestDriveRealtime';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { ActivityInsightsMini } from '@/components/ActivityInsightsMini';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarCheck, Clock, TrendingUp, Monitor, ShieldAlert, Car, RefreshCw, AlertTriangle, CheckCircle2, LayoutList, LayoutGrid, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GROCalendarView from './GROCalendarView';
import BlockedSlotsManager from './BlockedSlotsManager';
import { TestDriveInsightGrid } from './TestDriveInsightGrid';
import { StaffActivityGrid } from './StaffActivityGrid';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';

const GRODashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showInsights, setShowInsights] = useState(false);
  const [stats, setStats] = useState({ today: 0, upcoming: 0, completed: 0, completionRate: 0 });
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [noShowConfirmId, setNoShowConfirmId] = useState<string | null>(null);
  const [driveView, setDriveView] = useState<'list' | 'grid'>('list');
  const [detailSheetDrive, setDetailSheetDrive] = useState<any>(null);
  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  useEffect(() => {
    fetchTestDrives();
  }, [profile]);

  // Real-time: auto-refresh + toast when any test drive status changes
  useTestDriveRealtime(profile?.location_id, (event) => {
    const [testDriveId] = Object.keys(event);
    const eventData = event[testDriveId];
    const statusLabel = eventData.status.replace(/_/g, ' ');
     toast({
      title: 'Test Drive Updated',
      description: `Test Drive Id : - ${testDriveId} is now "${statusLabel}"`,
    });
    fetchTestDrives();
  });

  const fetchTestDrives = async () => {
    if (!profile?.location_id) return;
    const drives = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: profile.location_id }],
      order: [{ field: 'scheduled_date', ascending: true }],
    });

    const customerIds = Array.from(new Set((drives || []).map((d) => d.customer_id).filter(Boolean)));
    const vehicleIds = Array.from(new Set((drives || []).map((d) => d.vehicle_id).filter(Boolean)));
    const locationIds = Array.from(new Set((drives || []).map((d) => d.location_id).filter(Boolean)));

    const [customers, vehicles, locations] = await Promise.all([
      customerIds.length ? apiDbQuery<any[]>({ table: 'customers', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: customerIds }] }) : Promise.resolve([]),
      vehicleIds.length ? apiDbQuery<any[]>({ table: 'vehicles', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: vehicleIds }] }) : Promise.resolve([]),
      locationIds.length ? apiDbQuery<any[]>({ table: 'locations', action: 'select', select: '*', filters: [{ field: 'id', op: 'in', value: locationIds }] }) : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    const enriched = (drives || []).map((d) => ({
      ...d,
      customers: customerMap.get(d.customer_id) || null,
      vehicles: vehicleMap.get(d.vehicle_id) || null,
      locations: locationMap.get(d.location_id) || null,
    }));

    setTestDrives(enriched);
    const today = new Date().toISOString().split('T')[0];
    const completedCount = enriched.filter(t => t.status === 'completed').length;
    setStats({
      today: enriched.filter(t => t.scheduled_date === today).length,
      upcoming: enriched.filter(t => t.status === 'scheduled' || t.status === 'confirmed').length,
      completed: completedCount,
      completionRate: enriched.length > 0 ? Math.round((completedCount / enriched.length) * 100) : 0,
    });
  };

  const updateStatus = async (id: string, status: string) => {
    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: { status },
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    fetchTestDrives();
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newTime) return;
    const original = testDrives.find((t) => t.id === rescheduleId);
    if (!original) return;
    await apiDbQuery({
      table: 'test_drives',
      action: 'insert',
      values: [{
        customer_id: original.customer_id,
        vehicle_id: original.vehicle_id,
        location_id: original.location_id,
        assigned_sales_person_id: original.assigned_sales_person_id,
        assigned_gro_id: original.assigned_gro_id,
        scheduled_date: newDate,
        scheduled_time: newTime,
        source: original.source,
        rescheduled_from: rescheduleId,
      }],
    });
    await apiDbQuery({
      table: 'test_drives',
      action: 'update',
      payload: { status: 'rescheduled' },
      filters: [{ field: 'id', op: 'eq', value: rescheduleId }],
    });
    setRescheduleId(null);
    setNewDate('');
    setNewTime('');
    fetchTestDrives();
  };

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info',
    confirmed: 'bg-primary/10 text-primary',
    show: 'bg-success/10 text-success',
    no_show: 'bg-warning/10 text-warning',
    in_progress: 'bg-accent/10 text-accent-foreground',
    completed: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const waitingBoardUrl = profile?.location_id
    ? `/waiting-board?location=${profile.location_id}`
    : '/waiting-board';

  return (
    <div className="space-y-4 sm:space-y-6">
      
      <Tabs defaultValue="calendar" className="space-y-4">
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">GRO Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage test drive appointments</p>
          </div>

          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex rounded-md border bg-muted p-1 order-3 sm:order-none">
            <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendar</TabsTrigger>
            <TabsTrigger value="test-drives" className="text-xs sm:text-sm">Test Drives</TabsTrigger>
            <TabsTrigger value="staff-activity" className="text-xs sm:text-sm">
              <Activity className="h-3.5 w-3.5 mr-1" /> Staff Activity
            </TabsTrigger>
            <TabsTrigger value="blocked" className="text-xs sm:text-sm">
              <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Blocked
            </TabsTrigger>
          </TabsList>

          <div className="flex w-full sm:w-auto gap-2 order-2 sm:order-none">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowInsights((prev) => !prev)}>
              {showInsights ? 'Hide Insights' : 'Show Insights'}
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto" onClick={() => window.open(waitingBoardUrl, '_blank')}>
              <Monitor className="h-4 w-4 mr-2" /> Waiting Board
            </Button>
          </div>
        </div>
  {showInsights && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Today's Drives", value: stats.today, icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
            { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: CheckCircle2, color: 'text-accent-foreground', bg: 'bg-accent/10' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="shadow-card h-full min-w-0">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-h-[88px] sm:min-h-[96px]">
                  <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-heading font-bold leading-none text-foreground">{stat.value}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight break-words mt-1">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        {/* ── Activity Insights ── */}
        <ActivityInsightsMini />

        <TabsContent value="calendar">
          <GROCalendarView />
        </TabsContent>

        <TabsContent value="test-drives" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">All Test Drives <span className="text-muted-foreground">({testDrives.length})</span></p>
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
              <Button size="sm" variant={driveView === 'list' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-xs" onClick={() => setDriveView('list')}>
                <LayoutList className="h-3.5 w-3.5 mr-1" /> List
              </Button>
              <Button size="sm" variant={driveView === 'grid' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-xs" onClick={() => setDriveView('grid')}>
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Grid
              </Button>
            </div>
          </div>
          {driveView === 'grid' ? (
            <TestDriveInsightGrid testDrives={testDrives} title="Test Drives — Grouped View" />
          ) : (
          <Card className="shadow-card">
            <CardContent className="pt-4 sm:pt-6">
              <div className="space-y-3">
                {testDrives.slice(0, 5).map(td => (
                  <div
                    key={td.id}
                    className="p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setDetailSheetDrive(td)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm truncate">{td.customers?.full_name}</p>
                          <Badge variant="secondary" className={`text-xs ${statusColor[td.status] || ''}`}>
                             {formatStatusLabel(td.status)}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-xs">{td.source}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Car className="h-3 w-3" />
                          <span>{td.vehicles?.brand} {td.vehicles?.model}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{td.scheduled_date} {(td.scheduled_time || '').substring(0, 5)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                        {td.status === 'scheduled' && (
                          <>
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => updateStatus(td.id, 'confirmed')}>Confirm</Button>
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                          </>
                        )}
                        {td.status === 'confirmed' && (
                          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'show')}>Show</Button>
                        )}
                        
                        {td.status === 'in_progress' && (
                          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => updateStatus(td.id, 'completed')}>Complete</Button>
                        )}
                        {['scheduled', 'confirmed', 'show', 'no_show'].includes(td.status) && (
                          <Button size="sm" variant="outline" className="border-info/50 text-info hover:bg-info/10 text-xs gap-1" onClick={() => { setRescheduleId(td.id); setNewDate(''); setNewTime(''); }}>
                            <RefreshCw className="h-3 w-3" /> Reschedule
                          </Button>
                        )}
                        {['scheduled', 'confirmed', 'show'].includes(td.status) && (
                          <Button size="sm" variant="outline" className="border-warning/50 text-warning hover:bg-warning/10 text-xs gap-1" onClick={() => setNoShowConfirmId(td.id)}>
                            <AlertTriangle className="h-3 w-3" /> No Show
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {testDrives.length > 5 && (
                  <div className="flex justify-center pt-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/test-drives')}>
                      View All {testDrives.length} Test Drives →
                    </Button>
                  </div>
                )}
                {testDrives.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No test drives scheduled</p>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="staff-activity">
          <StaffActivityGrid />
        </TabsContent>

        <TabsContent value="blocked">
          <BlockedSlotsManager />
        </TabsContent>
      </Tabs>

      {/* Test Drive Detail Sheet */}
      <TestDriveDetailSheet
        testDrive={detailSheetDrive}
        open={!!detailSheetDrive}
        onClose={() => setDetailSheetDrive(null)}
      />

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleId} onOpenChange={(open) => !open && setRescheduleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reschedule Test Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Input type="date" value={newDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>New Time</Label>
              <Input type="time" value={newTime} min={newDate === new Date().toISOString().split('T')[0] ? `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}` : undefined} onChange={(e) => setNewTime(e.target.value)} />
            </div>
            <Button
              onClick={handleReschedule}
              disabled={!newDate || !newTime}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Show Confirmation Dialog */}
      <Dialog open={!!noShowConfirmId} onOpenChange={(o) => !o && setNoShowConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Mark as No Show?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const td = testDrives.find(t => t.id === noShowConfirmId);
              return td
                ? `Are you sure you want to mark ${td.customers?.full_name || 'this customer'}'s test drive as no-show?`
                : 'Are you sure you want to mark this test drive as no-show?';
            })()}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setNoShowConfirmId(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => { updateStatus(noShowConfirmId!, 'no_show'); setNoShowConfirmId(null); }}
            >
              Yes, Mark No Show
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    
    </div>
  );
};

export default GRODashboard;
