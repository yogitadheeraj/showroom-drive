import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck } from 'lucide-react';
import FollowUpOverview from '@/components/dashboards/FollowUpOverview';

const FollowUpsPage = () => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, any>>({});

  const fetchData = async () => {
    const rows = await apiDbQuery<any[]>({
      table: 'sales_tasks',
      action: 'select',
      select: 'id, title, due_at, status, priority, customer_id, assigned_to_profile_id, opportunity_id, created_at',
      filters: [{ field: 'status', op: 'eq', value: 'open' }],
      order: [{ field: 'due_at', ascending: true }],
      limit: 200,
    });

    const customerIds = Array.from(new Set((rows || []).map((task: any) => task.customer_id).filter(Boolean)));
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
    setTasks(rows || []);
  };

  useEffect(() => {
    void fetchData();
  }, [profile?.id]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => !task.assigned_to_profile_id || task.assigned_to_profile_id === profile?.id);
  }, [profile?.id, tasks]);

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

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Follow-up Center</h1>
          <p className="text-sm text-muted-foreground">Top opportunities and open follow-up tasks for all teams.</p>
        </div>

        <FollowUpOverview />

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Open Follow-up Tasks
              <Badge variant="secondary">{visibleTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks available.</p>
            ) : visibleTasks.map((task) => (
              <div key={task.id} className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {customersById[task.customer_id]?.full_name || 'Customer'}
                    {task.due_at ? ` • Due ${new Date(task.due_at).toLocaleString()}` : ' • Due not set'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!task.assigned_to_profile_id && (
                    <Button size="sm" onClick={() => takeFollowUp(task)}>Take Follow-up</Button>
                  )}
                  {task.assigned_to_profile_id === profile?.id && (
                    <Badge className="bg-success/10 text-success">Assigned to Me</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FollowUpsPage;
