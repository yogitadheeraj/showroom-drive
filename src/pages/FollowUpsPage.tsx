import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, ClipboardCheck, Filter } from 'lucide-react';

type FilterType = 'all' | 'opportunity' | 'task';

const STAGE_BADGE: Record<string, string> = {
  new: 'bg-info/10 text-info',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-purple-100 text-purple-700',
  proposal: 'bg-warning/10 text-warning',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-success/10 text-success',
  lost: 'bg-destructive/10 text-destructive',
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const TEMP_BADGE: Record<string, string> = {
  hot: 'bg-destructive/10 text-destructive',
  warm: 'bg-warning/10 text-warning',
  cold: 'bg-info/10 text-info',
};

const FollowUpsPage = () => {
  const { profile } = useAuth();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchData = async () => {
    const locationFilter = profile?.location_id
      ? [{ field: 'location_id', op: 'eq' as const, value: profile.location_id }]
      : [];

    const [oppRows, taskRows] = await Promise.all([
      apiDbQuery<any[]>({
        table: 'sales_opportunities',
        action: 'select',
        select: 'id, customer_id, temperature, stage, updated_at, notes, owner_profile_id, location_id',
        filters: [
          ...locationFilter,
          { field: 'stage', op: 'not_in', value: ['won', 'lost'] },
        ],
        order: [{ field: 'updated_at', ascending: false }],
        limit: 200,
      }),
      apiDbQuery<any[]>({
        table: 'sales_tasks',
        action: 'select',
        select: 'id, title, due_at, status, priority, customer_id, assigned_to_profile_id, opportunity_id, created_at',
        filters: [{ field: 'status', op: 'eq', value: 'open' }],
        order: [{ field: 'due_at', ascending: true }],
        limit: 200,
      }),
    ]);

    const customerIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.customer_id),
      ...(taskRows || []).map((t: any) => t.customer_id),
    ].filter(Boolean)));

    const customers = customerIds.length
      ? await apiDbQuery<any[]>({
          table: 'customers',
          action: 'select',
          select: 'id, full_name, phone',
          filters: [{ field: 'id', op: 'in', value: customerIds }],
        })
      : [];

    const customerMap = (customers || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});

    setCustomersById(customerMap);
    setOpportunities(oppRows || []);
    setTasks(taskRows || []);
  };

  useEffect(() => {
    void fetchData();
  }, [profile?.id]);

  const takeFollowUp = async (task: any) => {
    if (!profile?.id || !task?.id) return;
    await apiDbQuery({
      table: 'sales_tasks',
      action: 'update',
      payload: { assigned_to_profile_id: profile.id },
      filters: [{ field: 'id', op: 'eq', value: task.id }],
    });
    await fetchData();
  };

  // Merged list: visible tasks (unassigned or mine) + all hot/warm opps
  const mergedItems = useMemo(() => {
    const visibleTasks = tasks
      .filter((t) => !t.assigned_to_profile_id || t.assigned_to_profile_id === profile?.id)
      .map((t) => ({ ...t, _type: 'task' as const }));

    const oppItems = opportunities.map((o) => ({ ...o, _type: 'opportunity' as const }));

    if (filter === 'task') return visibleTasks;
    if (filter === 'opportunity') return oppItems;

    // Sort combined: tasks due soonest first, then opps by updated_at
    const allItems = [...visibleTasks, ...oppItems];
    allItems.sort((a, b) => {
      const aTime = a._type === 'task'
        ? (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER)
        : new Date(b.updated_at ?? 0).getTime();
      const bTime = b._type === 'task'
        ? (b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER)
        : new Date(a.updated_at ?? 0).getTime();
      return aTime - bTime;
    });

    return allItems;
  }, [opportunities, tasks, filter, profile?.id]);

  const oppCount = opportunities.length;
  const taskCount = tasks.filter((t) => !t.assigned_to_profile_id || t.assigned_to_profile_id === profile?.id).length;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Follow-up Center</h1>
            <p className="text-sm text-muted-foreground">Opportunities and open follow-up tasks for your team.</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(['all', 'opportunity', 'task'] as FilterType[]).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={filter === type ? 'default' : 'outline'}
                onClick={() => setFilter(type)}
                className="h-7 text-xs capitalize"
              >
                {type === 'all' ? `All (${oppCount + taskCount})` : type === 'opportunity' ? `Opportunities (${oppCount})` : `Tasks (${taskCount})`}
              </Button>
            ))}
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {filter === 'opportunity' ? (
                <Flame className="h-5 w-5 text-destructive" />
              ) : (
                <ClipboardCheck className="h-5 w-5 text-primary" />
              )}
              {filter === 'all' ? 'All Opportunities & Follow-ups' : filter === 'opportunity' ? 'Opportunities' : 'Follow-up Tasks'}
              <Badge variant="secondary">{mergedItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mergedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items found.</p>
            ) : mergedItems.map((item) => (
              item._type === 'opportunity' ? (
                <div key={`opp-${item.id}`} className="rounded-md border border-destructive/20 bg-destructive/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Flame className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-xs font-semibold text-destructive">Opportunity</span>
                      <Badge className={`text-[10px] h-4 px-1.5 capitalize ${TEMP_BADGE[item.temperature] ?? 'bg-muted text-muted-foreground'}`}>
                        {item.temperature || 'unknown'}
                      </Badge>
                      <Badge className={`text-[10px] h-4 px-1.5 capitalize ${STAGE_BADGE[item.stage] ?? 'bg-muted text-muted-foreground'}`}>
                        {item.stage || 'new'}
                      </Badge>
                    </div>
                    <p className="font-medium text-foreground truncate">{customersById[item.customer_id]?.full_name || 'Customer'}</p>
                    <p className="text-xs text-muted-foreground">
                      {customersById[item.customer_id]?.phone || ''}
                      {item.updated_at ? ` • Updated ${new Date(item.updated_at).toLocaleString()}` : ''}
                    </p>
                    {item.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>}
                  </div>
                </div>
              ) : (
                <div key={`task-${item.id}`} className="rounded-md border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <ClipboardCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-primary">Follow-up Task</span>
                      <Badge className="text-[10px] h-4 px-1.5 bg-info/10 text-info">open</Badge>
                      {item.priority && (
                        <Badge className={`text-[10px] h-4 px-1.5 capitalize ${PRIORITY_BADGE[item.priority] ?? 'bg-muted text-muted-foreground'}`}>
                          {item.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {customersById[item.customer_id]?.full_name || 'Customer'}
                      {item.due_at ? ` • Due ${new Date(item.due_at).toLocaleString()}` : ' • No due date'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!item.assigned_to_profile_id && (
                      <Button size="sm" onClick={() => takeFollowUp(item)}>Take Follow-up</Button>
                    )}
                    {item.assigned_to_profile_id === profile?.id && (
                      <Badge className="bg-success/10 text-success">Assigned to Me</Badge>
                    )}
                  </div>
                </div>
              )
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FollowUpsPage;


