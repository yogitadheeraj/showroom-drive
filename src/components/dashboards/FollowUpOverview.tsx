import { useEffect, useMemo, useState } from 'react';
import { apiDbQuery } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, ClipboardCheck } from 'lucide-react';

const FollowUpOverview = () => {
  const { profile } = useAuth();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!profile?.id) return;

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
          limit: 80,
        }),
        apiDbQuery<any[]>({
          table: 'sales_tasks',
          action: 'select',
          select: 'id, title, due_at, status, priority, customer_id, assigned_to_profile_id, opportunity_id',
          filters: [{ field: 'status', op: 'eq', value: 'open' }],
          order: [{ field: 'due_at', ascending: true }],
          limit: 120,
        }),
      ]);

      const customerIds = Array.from(new Set([...(oppRows || []).map((o: any) => o.customer_id), ...(taskRows || []).map((t: any) => t.customer_id)].filter(Boolean)));
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

    void fetchData();
  }, [profile?.id, profile?.location_id]);

  const hotTopFive = useMemo(() => {
    return opportunities
      .filter((opportunity) => opportunity.temperature === 'hot')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [opportunities]);

  const openTopFive = useMemo(() => {
    return tasks
      .sort((a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })
      .slice(0, 5);
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="shadow-card border-destructive/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            Top 5 Hot Opportunities
            <Badge variant="secondary">{hotTopFive.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hotTopFive.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hot opportunities yet.</p>
          ) : hotTopFive.map((opportunity) => (
            <div key={opportunity.id} className="rounded-md border p-2.5 text-sm">
              <p className="font-medium text-foreground">{customersById[opportunity.customer_id]?.full_name || 'Customer'}</p>
              <p className="text-xs text-muted-foreground">{opportunity.stage || 'new'} • Updated {new Date(opportunity.updated_at).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Open Follow-up Tasks
            <Badge variant="secondary">{openTopFive.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {openTopFive.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open follow-up tasks.</p>
          ) : openTopFive.map((task) => (
            <div key={task.id} className="rounded-md border p-2.5 text-sm">
              <p className="font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {customersById[task.customer_id]?.full_name || 'Customer'}
                {task.due_at ? ` • Due ${new Date(task.due_at).toLocaleString()}` : ' • Due not set'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default FollowUpOverview;
