import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, ClipboardCheck, Filter, Phone, Mail, Calendar, TrendingUp, Zap, UserCheck, Clock } from 'lucide-react';

type FilterType = 'all' | 'opportunity' | 'task';

const TEMP_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  hot:  { label: 'Hot',  bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-200',  dot: 'bg-rose-500' },
  warm: { label: 'Warm', bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200', dot: 'bg-amber-500' },
  cold: { label: 'Cold', bg: 'bg-sky-50',    text: 'text-sky-600',    border: 'border-sky-200',   dot: 'bg-sky-500' },
};

const STAGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  new:         { label: 'New',         bg: 'bg-slate-100',  text: 'text-slate-600' },
  contacted:   { label: 'Contacted',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  qualified:   { label: 'Qualified',   bg: 'bg-violet-100', text: 'text-violet-700' },
  proposal:    { label: 'Proposal',    bg: 'bg-amber-100',  text: 'text-amber-700' },
  negotiation: { label: 'Negotiation', bg: 'bg-orange-100', text: 'text-orange-700' },
  won:         { label: 'Won',         bg: 'bg-emerald-100',text: 'text-emerald-700' },
  lost:        { label: 'Lost',        bg: 'bg-red-100',    text: 'text-red-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; accent: string }> = {
  high:   { label: 'High',   bg: 'bg-rose-100',   text: 'text-rose-700',   accent: 'bg-rose-500' },
  medium: { label: 'Medium', bg: 'bg-amber-100',  text: 'text-amber-700',  accent: 'bg-amber-500' },
  low:    { label: 'Low',    bg: 'bg-slate-100',  text: 'text-slate-600',  accent: 'bg-slate-400' },
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
      ? await apiGet<any[]>(`/api/customers?ids=${encodeURIComponent(customerIds.join(','))}`)
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

  const mergedItems = useMemo(() => {
    const visibleTasks = tasks
      .filter((t) => !t.assigned_to_profile_id || t.assigned_to_profile_id === profile?.id)
      .map((t) => ({ ...t, _type: 'task' as const }));

    const oppItems = opportunities.map((o) => ({ ...o, _type: 'opportunity' as const }));

    if (filter === 'task') return visibleTasks;
    if (filter === 'opportunity') return oppItems;

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
  const hotCount = opportunities.filter((o) => o.temperature === 'hot').length;

  const formatDue = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
    if (diffH < 0) return { label: 'Overdue', cls: 'text-rose-600 font-semibold' };
    if (diffH < 24) return { label: `Due in ${diffH}h`, cls: 'text-amber-600 font-semibold' };
    return { label: d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), cls: 'text-muted-foreground' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Header ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Follow-up Center</h1>
            <p className="text-sm text-muted-foreground">Manage opportunities and open tasks for your team</p>
          </div>
        </div>

        {/* ── KPI chips ────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xl font-heading font-bold leading-none">{oppCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Opportunities</p>
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-heading font-bold leading-none">{taskCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Open Tasks</p>
            </div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-xl font-heading font-bold leading-none">{hotCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Hot Leads</p>
            </div>
          </div>
        </div>

        {/* ── Filter bar ───────────────────────────── */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {(['all', 'opportunity', 'task'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-colors border ${
                filter === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {type === 'all' ? `All · ${oppCount + taskCount}` : type === 'opportunity' ? `Opportunities · ${oppCount}` : `Tasks · ${taskCount}`}
            </button>
          ))}
        </div>

        {/* ── Item list ────────────────────────────── */}
        <div className="space-y-2">
          {mergedItems.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No items found for the selected filter.
              </CardContent>
            </Card>
          ) : mergedItems.map((item) => {
            const customer = customersById[item.customer_id];
            const phone = customer?.phone;
            const email = customer?.email;

            if (item._type === 'opportunity') {
              const temp = TEMP_CONFIG[item.temperature] ?? TEMP_CONFIG.cold;
              const stage = STAGE_CONFIG[item.stage] ?? STAGE_CONFIG.new;
              return (
                <div
                  key={`opp-${item.id}`}
                  className={`rounded-xl border ${temp.border} ${temp.bg} flex overflow-hidden`}
                >
                  {/* color accent strip */}
                  <div className={`w-1 shrink-0 ${temp.dot}`} />
                  <div className="flex-1 p-3 min-w-0">
                    {/* row 1: type + badges + time */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <Flame className={`h-3 w-3 shrink-0 ${temp.text}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${temp.text}`}>Opportunity</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${temp.bg} ${temp.text} border ${temp.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${temp.dot}`} />
                        {temp.label}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.text}`}>
                        {stage.label}
                      </span>
                      {item.updated_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {/* row 2: name + contact */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {customer?.full_name || 'Customer'}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors"
                            title={`Call ${phone}`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {email && (
                          <a
                            href={`mailto:${email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 flex items-center justify-center transition-colors"
                            title={`Email ${email}`}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    {/* row 3: contact text + notes */}
                    {(phone || email) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[phone, email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">"{item.notes}"</p>
                    )}
                  </div>
                </div>
              );
            }

            // Task card
            const prio = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low;
            const dueInfo = formatDue(item.due_at);
            const isOverdue = dueInfo?.label === 'Overdue';
            return (
              <div
                key={`task-${item.id}`}
                className={`rounded-xl border ${isOverdue ? 'border-rose-200 bg-rose-50' : 'border-primary/20 bg-primary/5'} flex overflow-hidden`}
              >
                <div className={`w-1 shrink-0 ${prio.accent}`} />
                <div className="flex-1 p-3 min-w-0">
                  {/* row 1: type + badges + due */}
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <ClipboardCheck className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Task</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${prio.bg} ${prio.text}`}>
                      {prio.label}
                    </span>
                    {dueInfo && (
                      <span className={`text-[10px] ml-auto flex items-center gap-0.5 ${dueInfo.cls}`}>
                        <Calendar className="h-2.5 w-2.5" />
                        {dueInfo.label}
                      </span>
                    )}
                  </div>
                  {/* row 2: task title */}
                  <p className="font-semibold text-sm text-foreground truncate mb-1">{item.title}</p>
                  {/* row 3: customer name + contact + action */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{customer?.full_name || 'Customer'}</p>
                      {(phone || email) && (
                        <p className="text-[11px] text-muted-foreground truncate">{[phone, email].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="h-7 w-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors"
                          title={`Call ${phone}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {email && (
                        <a
                          href={`mailto:${email}`}
                          className="h-7 w-7 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 flex items-center justify-center transition-colors"
                          title={`Email ${email}`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!item.assigned_to_profile_id && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => takeFollowUp(item)}>
                          Take
                        </Button>
                      )}
                      {item.assigned_to_profile_id === profile?.id && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <UserCheck className="h-3 w-3" /> Mine
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FollowUpsPage;

