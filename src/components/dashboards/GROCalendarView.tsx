import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, UserPlus, RefreshCw } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';

const statusColor: Record<string, string> = {
  scheduled: 'bg-info/10 text-info border-info/20',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  show: 'bg-success/10 text-success border-success/20',
  no_show: 'bg-warning/10 text-warning border-warning/20',
  in_progress: 'bg-green/10 text-green-foreground border-green/20',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  rescheduled: 'bg-muted text-muted-foreground border-border',
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8AM to 7PM

const GROCalendarView = () => {
  const { profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; testDriveId: string | null }>({ open: false, testDriveId: null });
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');

  useEffect(() => {
    fetchTestDrives();
    fetchSalesPersons();
  }, [profile, currentDate, viewMode]);

  const fetchTestDrives = async () => {
    if (!profile?.location_id) return;
    const startDate = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
    const endDate = viewMode === 'week' ? addDays(startDate, 6) : currentDate;

    const { data } = await supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*), profiles!test_drives_assigned_sales_person_id_fkey(id, full_name)')
      .eq('location_id', profile.location_id)
      .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
      .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'))
      .order('scheduled_time', { ascending: true });
    setTestDrives(data || []);
  };

  const fetchSalesPersons = async () => {
    const { data: rolesData } = await supabase.from('user_roles').select('user_id').eq('role', 'sales');
    if (!rolesData?.length) { setSalesPersons([]); return; }
    const userIds = rolesData.map(r => r.user_id);
    const { data } = await supabase.from('profiles')
      .select('id, full_name, user_id, location_id, locations(name)')
      .eq('is_active', true)
      .in('user_id', userIds);
    setSalesPersons(data || []);
  };

  const handleAssign = async () => {
    if (!assignDialog.testDriveId || !selectedSalesPerson) return;
    await supabase.from('test_drives')
      .update({ assigned_sales_person_id: selectedSalesPerson })
      .eq('id', assignDialog.testDriveId);
    setAssignDialog({ open: false, testDriveId: null });
    setSelectedSalesPerson('');
    fetchTestDrives();
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const getBookingsForSlot = (date: Date, hour: number) => {
    return testDrives.filter(td => {
      const tdDate = parseISO(td.scheduled_date);
      const tdHour = parseInt(td.scheduled_time?.split(':')[0] || '0');
      return isSameDay(tdDate, date) && tdHour === hour;
    });
  };

  const navigate = (dir: number) => {
    setCurrentDate(prev => addDays(prev, viewMode === 'week' ? dir * 7 : dir));
  };

  const renderBookingCard = (td: any) => (
    <div key={td.id} className={`p-2 rounded-md border text-xs mb-1 ${statusColor[td.status] || 'bg-muted'}`}>
      <p className="font-medium truncate">{td.customers?.full_name}</p>
      <p className="truncate opacity-80">{td.vehicles?.brand} {td.vehicles?.model}</p>
      <div className="flex items-center justify-between mt-1">
        {td.profiles?.full_name ? (
          <span className="text-[10px] font-medium bg-background/50 px-1.5 py-0.5 rounded">{td.profiles.full_name}</span>
        ) : (
          <span className="text-[10px] italic opacity-60">Unassigned</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0"
          onClick={() => {
            setAssignDialog({ open: true, testDriveId: td.id });
            setSelectedSalesPerson(td.assigned_sales_person_id || '');
          }}
        >
          {td.profiles?.full_name ? <RefreshCw className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-heading font-semibold text-foreground min-w-[200px] text-center">
            {viewMode === 'day'
              ? format(currentDate, 'EEEE, MMM d, yyyy')
              : `${format(weekDays[0], 'MMM d')} — ${format(weekDays[6], 'MMM d, yyyy')}`
            }
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
          >
            <Calendar className="h-4 w-4 mr-1" /> Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Week
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/30">
                  <th className="p-2 text-left text-muted-foreground font-medium w-20 border-r border-border">Time</th>
                  {viewMode === 'day' ? (
                    <th className="p-2 text-center text-foreground font-medium">
                      {format(currentDate, 'EEEE, MMM d')}
                    </th>
                  ) : (
                    weekDays.map(day => (
                      <th key={day.toISOString()} className={`p-2 text-center font-medium border-l border-border min-w-[140px] ${isSameDay(day, new Date()) ? 'text-primary bg-primary/5' : 'text-foreground'}`}>
                        <div>{format(day, 'EEE')}</div>
                        <div className="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour} className="border-t border-border/50">
                    <td className="p-2 text-xs text-muted-foreground align-top border-r border-border font-mono">
                      {`${hour.toString().padStart(2, '0')}:00`}
                    </td>
                    {viewMode === 'day' ? (
                      <td className="p-1 align-top min-h-[60px]">
                        {getBookingsForSlot(currentDate, hour).map(renderBookingCard)}
                      </td>
                    ) : (
                      weekDays.map(day => (
                        <td key={day.toISOString()} className="p-1 align-top border-l border-border/50 min-h-[60px]">
                          {getBookingsForSlot(day, hour).map(renderBookingCard)}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Assign/Reassign Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => !o && setAssignDialog({ open: false, testDriveId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selectedSalesPerson ? 'Reassign' : 'Assign'} Sales Person
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedSalesPerson} onValueChange={setSelectedSalesPerson}>
              <SelectTrigger>
                <SelectValue placeholder="Select sales person" />
              </SelectTrigger>
              <SelectContent>
                {salesPersons.map(sp => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.full_name}{sp.locations?.name ? ` — ${sp.locations.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} className="w-full" disabled={!selectedSalesPerson}>
              Confirm Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GROCalendarView;
