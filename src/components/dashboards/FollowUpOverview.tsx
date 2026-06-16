import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDbQuery } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, ClipboardCheck, ArrowRight } from 'lucide-react';

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

  const hotTopFive = useMemo(() =>
    opportunities
      .filter((o) => o.temperature === 'hot')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5),
  [opportunities]);

  const openTopFive = useMemo(() =>
    tasks
      .sort((a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })
      .slice(0, 5),
  [tasks]);

  // Merge: opportunities first, then tasks, max 10 total shown
  const mergedItems = useMemo(() => {
    const oppItems = hotTopFive.map((o) => ({ ...o, _type: 'opportunity' as const }));
    const taskItems = openTopFive.map((t) => ({ ...t, _type: 'task' as const }));
    return [...oppItems, ...taskItems];
  }, [hotTopFive, openTopFive]);

  const totalCount = hotTopFive.length + openTopFive.length;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive" />
          Opportunities &amp; Follow-up Tasks
          <Badge variant="secondary">{totalCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {mergedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hot opportunities or open tasks.</p>
        ) : mergedItems.map((item) => (
          item._type === 'opportunity' ? (
            <div key={`opp-${item.id}`} className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Flame className="h-3 w-3 text-destructive shrink-0" />
                  <span className="text-xs font-semibold text-destructive">Hot Opportunity</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">{item.stage || 'new'}</Badge>
                </div>
                <p className="font-medium text-foreground text-sm truncate">{customersById[item.customer_id]?.full_name || 'Customer'}</p>
                <p className="text-xs text-muted-foreground">Updated {new Date(item.updated_at).toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <div key={`task-${item.id}`} className="rounded-md border border-primary/20 bg-primary/5 p-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ClipboardCheck className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary">Follow-up Task</span>
                  {item.priority && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">{item.priority}</Badge>
                  )}
                </div>
                <p className="font-medium text-foreground text-sm truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {customersById[item.customer_id]?.full_name || 'Customer'}
                  {item.due_at ? ` • Due ${new Date(item.due_at).toLocaleString()}` : ' • No due date'}
                </p>
              </div>
            </div>
          )
        ))}
      </CardContent>
      {totalCount > 0 && (
        <CardFooter className="pt-0">
          <Link to="/follow-ups" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all follow-ups <ArrowRight className="h-3 w-3" />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
};

export default FollowUpOverview;
