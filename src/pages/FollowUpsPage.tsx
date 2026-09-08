import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery, apiGet } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Flame, ClipboardCheck, Filter, Phone, Mail, Calendar, TrendingUp, Zap, UserCheck, Clock, User, ArrowUpRight, BadgeCheck, Snowflake } from 'lucide-react';

type FilterType = 'all' | 'opportunity' | 'task' | 'hot' | 'warm' | 'cold';

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
  const [profilesById, setProfilesById] = useState<Record<string, any>>({});
  const [testDrivesById, setTestDrivesById] = useState<Record<string, any>>({});
  const [feedbackByCustomerId, setFeedbackByCustomerId] = useState<Record<string, any[]>>({});
  const [historyByCustomerId, setHistoryByCustomerId] = useState<Record<string, any[]>>({});
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

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
        limit: 500,
      }),
      apiDbQuery<any[]>({
        table: 'sales_tasks',
        action: 'select',
        select: 'id, title, due_at, status, priority, customer_id, assigned_to_profile_id, opportunity_id, created_at',
        filters: [{ field: 'status', op: 'eq', value: 'open' }],
        order: [{ field: 'due_at', ascending: true }],
        limit: 500,
      }),
    ]);

    const customerIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.customer_id),
      ...(taskRows || []).map((t: any) => t.customer_id),
    ].filter(Boolean)));

    const profileIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.owner_profile_id),
      ...(taskRows || []).map((t: any) => t.assigned_to_profile_id),
    ].filter(Boolean)));

    const driveIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.latest_test_drive_id),
      ...(taskRows || []).map((t: any) => t.test_drive_id),
    ].filter(Boolean)));

    const [customers, profiles, drives, feedbackRows, activityEvents] = await Promise.all([
      customerIds.length
        ? apiGet<any[]>(`/api/customers?ids=${encodeURIComponent(customerIds.join(','))}`)
        : Promise.resolve([]),
      profileIds.length
        ? apiDbQuery<any[]>({
            table: 'profiles',
            action: 'select',
            select: 'id, full_name, email, phone',
            filters: [{ field: 'id', op: 'in', value: profileIds }],
          })
        : Promise.resolve([]),
      driveIds.length
        ? apiGet<any[]>(`/api/test-drives?ids=${encodeURIComponent(driveIds.join(','))}`)
        : Promise.resolve([]),
      customerIds.length
        ? apiDbQuery<any[]>({
            table: 'test_drive_feedback',
            action: 'select',
            select: 'id, test_drive_id, customer_id, customer_name, rating, experience_badge, total_duration_minutes, feedback_text, would_recommend, created_at',
            filters: [{ field: 'customer_id', op: 'in', value: customerIds }],
            order: [{ field: 'created_at', ascending: false }],
            limit: 200,
          })
        : Promise.resolve([]),
      apiGet<any[]>(`/api/activity/events?limit=400`),
    ]);

    const customerMap = (customers || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const profileMap = (profiles || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const driveMap = (drives || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const feedbackMap = (feedbackRows || []).reduce((acc: Record<string, any[]>, row: any) => {
      const customerId = row.customer_id;
      if (!customerId) return acc;
      acc[customerId] = [...(acc[customerId] || []), row];
      return acc;
    }, {});

    const eventProfileIds = Array.from(new Set((activityEvents || []).map((event: any) => event.profile_id).filter(Boolean)));
    const activityProfileRows = eventProfileIds.length
      ? await apiDbQuery<any[]>({
          table: 'profiles',
          action: 'select',
          select: 'id, full_name',
          filters: [{ field: 'id', op: 'in', value: eventProfileIds }],
        })
      : [];

    const activityProfileMap = (activityProfileRows || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});

    const historyMap = (activityEvents || []).reduce((acc: Record<string, any[]>, event: any) => {
      const meta = event?.metadata ?? {};
      const customerId = meta.customerId || meta.customer_id || null;
      if (!customerId || !customerIds.includes(customerId)) return acc;
      acc[customerId] = [...(acc[customerId] || []), {
        ...event,
        profile_name: activityProfileMap[event.profile_id]?.full_name || 'Team',
      }];
      return acc;
    }, {});

    setCustomersById(customerMap);
    setProfilesById({ ...profileMap, ...activityProfileMap });
    setTestDrivesById(driveMap);
    setFeedbackByCustomerId(feedbackMap);
    setHistoryByCustomerId(historyMap);
    setOpportunities((oppRows || []).map((opp: any) => ({
      ...opp,
      linked_drive: driveMap[opp.latest_test_drive_id] || null,
      owner_profile: profileMap[opp.owner_profile_id] || null,
    })));
    setTasks((taskRows || []).map((task: any) => ({
      ...task,
      linked_drive: task.test_drive_id ? driveMap[task.test_drive_id] || null : null,
      assigned_profile: profileMap[task.assigned_to_profile_id] || null,
    })));
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
    if (filter === 'hot') return oppItems.filter((o) => o.temperature === 'hot');
    if (filter === 'warm') return oppItems.filter((o) => o.temperature === 'warm');
    if (filter === 'cold') return oppItems.filter((o) => o.temperature === 'cold');

    const allItems = [...visibleTasks, ...oppItems];
    allItems.sort((a, b) => {
      const aTime = a._type === 'task'
        ? (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER)
        : (a.updated_at ? new Date(a.updated_at).getTime() : 0);
      const bTime = b._type === 'task'
        ? (b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER)
        : (b.updated_at ? new Date(b.updated_at).getTime() : 0);
      return aTime - bTime;
    });

    return allItems;
  }, [opportunities, tasks, filter, profile?.id]);

  const oppCount = opportunities.length;
  const taskCount = tasks.filter((t) => !t.assigned_to_profile_id || t.assigned_to_profile_id === profile?.id).length;
  const hotCount = opportunities.filter((o) => o.temperature === 'hot').length;
  const warmCount = opportunities.filter((o) => o.temperature === 'warm').length;
  const coldCount = opportunities.filter((o) => o.temperature === 'cold').length;

  const filterCards: Array<{ key: FilterType; label: string; count: number; activeClass: string; inactiveClass: string; dotClass: string }> = [
    { key: 'all', label: 'All', count: oppCount + taskCount, activeClass: 'bg-slate-900 text-white border-slate-900', inactiveClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300', dotClass: 'bg-slate-500' },
    { key: 'opportunity', label: 'Opportunities', count: oppCount, activeClass: 'bg-violet-600 text-white border-violet-600', inactiveClass: 'bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-300', dotClass: 'bg-violet-500' },
    { key: 'task', label: 'Tasks', count: taskCount, activeClass: 'bg-emerald-600 text-white border-emerald-600', inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300', dotClass: 'bg-emerald-500' },
    { key: 'hot', label: 'Hot', count: hotCount, activeClass: 'bg-rose-600 text-white border-rose-600', inactiveClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300', dotClass: 'bg-rose-500' },
    { key: 'warm', label: 'Warm', count: warmCount, activeClass: 'bg-amber-500 text-white border-amber-500', inactiveClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300', dotClass: 'bg-amber-500' },
    { key: 'cold', label: 'Cold', count: coldCount, activeClass: 'bg-sky-600 text-white border-sky-600', inactiveClass: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-300', dotClass: 'bg-sky-500' },
  ];

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
      <div className="space-y-6">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-background via-background to-violet-50/60 p-5 shadow-sm dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className=" inline-flex gap-2">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
                <ClipboardCheck className="h-3 w-3" />
                Sales pipeline
              </div>
            
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                <TrendingUp className="h-3 w-3" />
                Total Opportunities {oppCount}
              </div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <Flame className="h-3 w-3" />
                Hot leads {hotCount}
              </div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                <Snowflake className="h-3 w-3" />
                Cold leads {coldCount}
              </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Follow-up Center</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage opportunities and open tasks for your team</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Clock className="h-3.5 w-3.5 text-violet-600" />
              Prioritized queue
            </div>
          </div>
         <div className="grid gap-3 md:grid-cols-3 hidden md:gap-4 lg:grid-cols-6">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-violet-700 dark:text-violet-200">Pipeline</span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{oppCount}</p>
            <p className="text-xs text-muted-foreground">Active opportunities</p>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-sky-700 dark:text-sky-200">Open</span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{taskCount}</p>
            <p className="text-xs text-muted-foreground">Follow-up tasks</p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900 dark:bg-rose-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-rose-700 dark:text-rose-200">Priority</span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{hotCount}</p>
            <p className="text-xs text-muted-foreground">Hot leads</p>
          </div>
        </div>
        </div>

    

        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filter queue
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {filterCards.map((item) => {
              const isActive = filter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all ${isActive ? item.activeClass : item.inactiveClass}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </div>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/15 text-current' : 'bg-white/80 text-current'}`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {mergedItems.length === 0 ? (
            <Card className="border-dashed border-border bg-muted/20 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No items found for the selected filter.
              </CardContent>
            </Card>
          ) : mergedItems.map((item) => {
            const customer = customersById[item.customer_id];
            const phone = customer?.phone;
            const email = customer?.email;
            const isSelected = selectedItem && selectedItem.id === item.id && selectedItem._type === item._type;

            if (item._type === 'opportunity') {
              const temp = TEMP_CONFIG[item.temperature] ?? TEMP_CONFIG.cold;
              const stage = STAGE_CONFIG[item.stage] ?? STAGE_CONFIG.new;
              return (
                <div
                  key={`opp-${item.id}`}
                  onClick={() => setSelectedItem(item)}
                  className={`flex cursor-pointer overflow-hidden rounded-2xl border bg-background shadow-sm transition-all hover:shadow-md dark:bg-slate-950 ${temp.border} ${isSelected ? 'ring-2 ring-violet-300 ring-offset-1' : ''}`}
                >
                  <div className={`w-1.5 shrink-0 ${temp.dot}`} />
                  <div className="flex-1 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Flame className={`h-3.5 w-3.5 ${temp.text}`} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Opportunity</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${temp.bg} ${temp.text} ${temp.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${temp.dot}`} />
                        {temp.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stage.bg} ${stage.text}`}>
                        {stage.label}
                      </span>
                      {item.updated_at && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{customer?.full_name || 'Customer'}</p>
                        {(phone || email) && (
                          <p className="mt-1 text-xs text-muted-foreground">{[phone, email].filter(Boolean).join(' · ')}</p>
                        )}
                        {item.notes && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground italic">“{item.notes}”</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {phone && (
                          <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200" title={`Call ${phone}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {email && (
                          <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 transition hover:bg-sky-200" title={`Email ${email}`}>
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const prio = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low;
            const dueInfo = formatDue(item.due_at);
            const isOverdue = dueInfo?.label === 'Overdue';
            return (
              <div
                key={`task-${item.id}`}
                onClick={() => setSelectedItem(item)}
                className={`flex cursor-pointer overflow-hidden rounded-2xl border bg-background shadow-sm transition-all hover:shadow-md dark:bg-slate-950 ${isOverdue ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/10' : 'border-border bg-card/90'} ${isSelected ? 'ring-2 ring-primary/40 ring-offset-1' : ''}`}
              >
                <div className={`w-1.5 shrink-0 ${prio.accent}`} />
                <div className="flex-1 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Task</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prio.bg} ${prio.text}`}>
                      {prio.label}
                    </span>
                    {dueInfo && (
                      <span className={`ml-auto flex items-center gap-1 text-[10px] ${dueInfo.cls}`}>
                        <Calendar className="h-3 w-3" />
                        {dueInfo.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{customer?.full_name || 'Customer'}</p>
                      {(phone || email) && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{[phone, email].filter(Boolean).join(' · ')}</p>
                      )}
                      {item.notes && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground italic">“{item.notes}”</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {phone && (
                        <a href={`tel:${phone}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200" title={`Call ${phone}`}>
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {email && (
                        <a href={`mailto:${email}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 transition hover:bg-sky-200" title={`Email ${email}`}>
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!item.assigned_to_profile_id && (
                        <Button size="sm" className="h-8 px-3 text-xs" onClick={(e) => { e.stopPropagation(); void takeFollowUp(item); }}>
                          Take
                        </Button>
                      )}
                      {item.assigned_to_profile_id === profile?.id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                          <UserCheck className="h-3 w-3" />
                          Mine
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

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-left text-base">
              {selectedItem?._type === 'opportunity' ? <Flame className="h-4 w-4 text-rose-500" /> : <ClipboardCheck className="h-4 w-4 text-primary" />}
              {selectedItem?._type === 'opportunity' ? 'Opportunity details' : 'Task details'}
            </SheetTitle>
            <SheetDescription>
              {selectedItem?._type === 'opportunity' ? 'Pipeline status and contact information' : 'Task follow-up and due date'}
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-5 p-5">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {customersById[selectedItem.customer_id]?.full_name || 'Customer'}
                  </div>
                  {selectedItem._type === 'opportunity' ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TEMP_CONFIG[selectedItem.temperature]?.bg ?? 'bg-sky-50'} ${TEMP_CONFIG[selectedItem.temperature]?.text ?? 'text-sky-600'}`}>
                      {TEMP_CONFIG[selectedItem.temperature]?.label ?? 'Cold'}
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_CONFIG[selectedItem.priority]?.bg ?? 'bg-slate-100'} ${PRIORITY_CONFIG[selectedItem.priority]?.text ?? 'text-slate-600'}`}>
                      {PRIORITY_CONFIG[selectedItem.priority]?.label ?? 'Low'}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {customersById[selectedItem.customer_id]?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${customersById[selectedItem.customer_id].phone}`} className="text-foreground hover:underline">{customersById[selectedItem.customer_id].phone}</a>
                    </div>
                  )}
                  {customersById[selectedItem.customer_id]?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <a href={`mailto:${customersById[selectedItem.customer_id].email}`} className="text-foreground hover:underline">{customersById[selectedItem.customer_id].email}</a>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                {selectedItem._type === 'opportunity' ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Owner</span>
                      <span className="text-foreground font-medium text-right">{(selectedItem.owner_profile || profilesById[selectedItem.owner_profile_id])?.full_name || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stage</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_CONFIG[selectedItem.stage]?.bg ?? 'bg-slate-100'} ${STAGE_CONFIG[selectedItem.stage]?.text ?? 'text-slate-600'}`}>
                        {STAGE_CONFIG[selectedItem.stage]?.label ?? 'New'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="text-foreground">{selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Title</span>
                      <span className="text-foreground font-medium text-right">{selectedItem.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Due</span>
                      <span className="text-foreground">{selectedItem.due_at ? new Date(selectedItem.due_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No date'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Assigned</span>
                      <span className="text-foreground">{(selectedItem.assigned_profile || profilesById[selectedItem.assigned_to_profile_id])?.full_name || 'Unassigned'}</span>
                    </div>
                  </>
                )}
              </div>

              {(selectedItem._type === 'opportunity' ? (selectedItem.linked_drive || testDrivesById[selectedItem.latest_test_drive_id]) : (selectedItem.linked_drive || testDrivesById[selectedItem.test_drive_id])) && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Calendar className="h-4 w-4 text-violet-600" />
                    Linked test drive
                  </div>
                  {(() => {
                    const linkedDrive = selectedItem._type === 'opportunity'
                      ? (selectedItem.linked_drive || testDrivesById[selectedItem.latest_test_drive_id])
                      : (selectedItem.linked_drive || testDrivesById[selectedItem.test_drive_id]);
                    const vehicleName = linkedDrive?.vehicles ? `${linkedDrive.vehicles.brand || ''} ${linkedDrive.vehicles.model || ''}`.trim() : linkedDrive?.vehicle_name || 'Vehicle';
                    return (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Test Drive ID</span>
                          <a
                            href="/test-drives"
                            onClick={(e) => e.stopPropagation()}
                            className="text-foreground font-medium text-right underline underline-offset-2 hover:text-violet-600"
                            title={linkedDrive?.id || 'Test drive ID'}
                          >
                            {linkedDrive?.id ? `#${linkedDrive.id.slice(0, 8)}` : '—'}
                          </a>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Drive</span>
                          <span className="text-foreground font-medium text-right">{vehicleName || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Status</span>
                          <span className="text-foreground">{linkedDrive?.status || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Date</span>
                          <span className="text-foreground">{linkedDrive?.scheduled_date ? new Date(linkedDrive.scheduled_date).toLocaleDateString([], { dateStyle: 'medium' }) : '—'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {(() => {
                const customerId = selectedItem.customer_id;
                const feedbackHistory = customerId ? (feedbackByCustomerId[customerId] || []).slice(0, 3) : [];
                return feedbackHistory.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                      Customer feedback
                    </div>
                    <div className="space-y-3">
                      {feedbackHistory.map((item: any) => (
                        <div key={item.id} className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                            <span>{item.experience_badge || 'Experience'}</span>
                            <span>{item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                          </div>
                          <div className="mb-1 flex items-center gap-1 text-amber-500">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <span key={index} className={index < (item.rating || 0) ? 'text-amber-500' : 'text-slate-300'}>★</span>
                            ))}
                          </div>
                          {item.feedback_text && <p className="text-sm leading-6 text-muted-foreground">“{item.feedback_text}”</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {selectedItem.notes && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    {selectedItem._type === 'opportunity' ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-violet-600" />}
                    {selectedItem._type === 'opportunity' ? 'Opportunity notes' : 'Task notes'}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{selectedItem.notes}</p>
                </div>
              )}
              {(() => {
                const customerId = selectedItem.customer_id;
                const eventHistory = customerId ? (historyByCustomerId[customerId] || []).slice(0, 8) : [];
                return eventHistory.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Clock className="h-4 w-4 text-violet-600" />
                      Test drive history
                    </div>
                    <div className="space-y-3">
                      {eventHistory.map((event: any) => (
                        <div key={`${event.id}-${event.happened_at}`} className="flex gap-3 rounded-xl border border-border bg-muted/20 p-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{event.event_label || event.event_type || 'Activity'}</p>
                              <span className="text-[10px] text-muted-foreground">{event.happened_at ? new Date(event.happened_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{event.profile_name || 'Team'} · {event.happened_at ? new Date(event.happened_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default FollowUpsPage;

