import { useMemo, useState } from 'react';
import { goBack, goForward } from '@/lib/browserNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Car, Clock, MapPin, User, ChevronLeft, ChevronRight, X, Calendar, Shield } from 'lucide-react';
import { TestDriveDetailSheet } from '@/components/TestDriveDetailSheet';

type CalViewType = 'week' | 'month' | 'year';

const STATUS_CAL: Record<string, string> = {
  scheduled:   'bg-blue-500 text-white',
  confirmed:   'bg-indigo-500 text-white',
  show:        'bg-emerald-500 text-white',
  no_show:     'bg-amber-500 text-white',
  in_progress: 'bg-orange-500 text-white',
  completed:   'bg-green-600 text-white',
  cancelled:   'bg-red-500 text-white',
  rescheduled: 'bg-slate-400 text-white',
};

const STATUS_DOT: Record<string, string> = {
  scheduled:   'bg-blue-500',
  confirmed:   'bg-indigo-500',
  show:        'bg-emerald-500',
  no_show:     'bg-amber-500',
  in_progress: 'bg-orange-500',
  completed:   'bg-green-600',
  cancelled:   'bg-red-500',
  rescheduled: 'bg-slate-400',
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_HOURS    = Array.from({ length: 13 }, (_, i) => i + 8);

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Props {
  testDrives: any[];
}

export default function TestDriveCalendarMini({ testDrives }: Props) {
  const [viewType, setViewType]       = useState<CalViewType>('week');
  const [baseDate, setBaseDate]       = useState(() => new Date());
  const [insight, setInsight]         = useState<{ type: 'day' | 'month' | 'year'; date: Date } | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<any | null>(null);
  const [detailSheet, setDetailSheet] = useState<any | null>(null);

  // ── Week helpers ──────────────────────────────────────────────────────────
  const weekStart = useMemo(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [baseDate]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]);

  // ── Month grid ────────────────────────────────────────────────────────────
  const monthGrid = useMemo(() => {
    const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const start = new Date(first); start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  }, [baseDate]);

  // ── Data helpers ──────────────────────────────────────────────────────────
  const drivesOnDay   = (day: Date)                         => testDrives.filter(td => td.scheduled_date === fmtDate(day));
  const drivesInMonth = (y: number, m: number)              => testDrives.filter(td => { if (!td.scheduled_date) return false; const [ty,tm] = td.scheduled_date.split('-').map(Number); return ty === y && tm - 1 === m; });
  const drivesInYear  = (y: number)                         => testDrives.filter(td => td.scheduled_date?.startsWith(String(y)));
  const driveAtHour   = (day: Date, hour: number)           => drivesOnDay(day).filter(td => parseInt((td.scheduled_time || '00:00').split(':')[0], 10) === hour);

  // ── Insight data ──────────────────────────────────────────────────────────
  const insightDrives = useMemo(() => {
    if (!insight) return [];
    if (insight.type === 'day') return drivesOnDay(insight.date);
    if (insight.type === 'month') return drivesInMonth(insight.date.getFullYear(), insight.date.getMonth());
    return drivesInYear(insight.date.getFullYear());
  }, [insight, testDrives]);

  const insightLabel = useMemo(() => {
    if (!insight) return '';
    if (insight.type === 'day')   return insight.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (insight.type === 'month') return insight.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `Year ${insight.date.getFullYear()}`;
  }, [insight]);

  const insightStats = useMemo(() => {
    const total = insightDrives.length;
    const byStatus = insightDrives.reduce((acc: Record<string, number>, td) => { acc[td.status] = (acc[td.status] || 0) + 1; return acc; }, {});
    return { total, byStatus, completionRate: total > 0 ? Math.round(((byStatus.completed || 0) / total) * 100) : 0 };
  }, [insightDrives]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const isAtCurrentYear = viewType === 'year' && baseDate.getFullYear() >= currentYear;

  const navigate = (dir: 1 | -1) => {
    if (dir === 1 && isAtCurrentYear) return; // no forward past current year
    const d = new Date(baseDate);
    if (viewType === 'week')  d.setDate(d.getDate() + dir * 7);
    else if (viewType === 'month') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setBaseDate(d);
    setInsight(null);
    setSelectedDrive(null);
  };

  const periodLabel =
    viewType === 'week'  ? `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` :
    viewType === 'month' ? baseDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) :
    String(baseDate.getFullYear());

  return (
    <div className="flex gap-3 h-[580px]">
      {/* ── Calendar ── */}
      <div className="flex-1 min-w-0 border border-border rounded-xl bg-card flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-wrap">
          {/* View type */}
          <div className="flex border border-border rounded-md overflow-hidden text-[11px]">
            {(['week','month','year'] as CalViewType[]).map(vt => (
              <button key={vt} onClick={() => { setViewType(vt); setInsight(null); setSelectedDrive(null); }}
                className={`px-2.5 py-1 capitalize transition-colors ${viewType === vt ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                {vt}
              </button>
            ))}
          </div>
          {/* Nav */}
          <button onClick={goBack} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="text-xs font-semibold text-foreground flex-1 text-center min-w-[140px]">{periodLabel}</span>
          <button onClick={goForward} disabled={isAtCurrentYear} className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${isAtCurrentYear ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted'}`}><ChevronRight className="h-3.5 w-3.5" /></button>
          <button onClick={() => { setBaseDate(new Date()); setInsight(null); }} className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-muted">Today</button>
        </div>

        {/* ── WEEK VIEW ── */}
        {viewType === 'week' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-[44px_repeat(7,1fr)] border-b border-border shrink-0">
              <div className="border-r border-border" />
              {weekDays.map(day => {
                const isToday   = day.toDateString() === new Date().toDateString();
                const count     = drivesOnDay(day).length;
                const isSelected = insight?.type === 'day' && insight.date.toDateString() === day.toDateString();
                return (
                  <button key={day.toISOString()} onClick={() => setInsight({ type: 'day', date: day })}
                    className={`py-1.5 px-1 text-center border-r border-border last:border-r-0 transition-colors hover:bg-primary/5 ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''}`}>
                    <div className={`text-[9px] uppercase tracking-wide font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</div>
                    {count > 0 && <div className="text-[8px] text-primary font-medium">{count}</div>}
                  </button>
                );
              })}
            </div>
            {/* Time slots */}
            <div className="overflow-y-auto flex-1">
              {CAL_HOURS.map(hour => (
                <div key={hour} className="grid grid-cols-[44px_repeat(7,1fr)] border-b border-border last:border-b-0 min-h-[50px]">
                  <div className="border-r border-border px-1 py-0.5 flex items-start justify-end">
                    <span className="text-[9px] text-muted-foreground">{hour > 12 ? `${hour-12}p` : hour === 12 ? '12p' : `${hour}a`}</span>
                  </div>
                  {weekDays.map(day => {
                    const drives  = driveAtHour(day, hour);
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <div key={day.toISOString()} className={`border-r border-border last:border-r-0 p-0.5 space-y-0.5 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                        {drives.map(td => (
                          <button key={td.id} onClick={() => { setSelectedDrive(td); setInsight({ type: 'day', date: day }); }}
                            className={`w-full text-left rounded px-1 py-0.5 text-[9px] font-medium leading-tight truncate hover:opacity-80 ${STATUS_CAL[td.status] ?? 'bg-slate-400 text-white'} ${selectedDrive?.id === td.id ? 'ring-1 ring-white ring-offset-1' : ''}`}>
                            <div className="font-semibold truncate">{td.customers?.full_name || 'Customer'}</div>
                            <div className="opacity-80 truncate">{td.vehicles?.brand} {td.vehicles?.model}</div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {viewType === 'month' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border shrink-0">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="py-1.5 text-center text-[9px] uppercase tracking-wide font-medium text-muted-foreground border-r border-border last:border-r-0">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 overflow-y-auto">
              {monthGrid.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === baseDate.getMonth();
                const isToday    = day.toDateString() === new Date().toDateString();
                const drives     = drivesOnDay(day);
                const isSelected = insight?.type === 'day' && insight.date.toDateString() === day.toDateString();
                return (
                  <button key={idx} onClick={() => setInsight({ type: 'day', date: day })}
                    className={`border-r border-b border-border last-of-type:border-r-0 p-1 text-left min-h-[70px] transition-colors hover:bg-primary/5 ${!isCurrentMonth ? 'bg-muted/20' : ''} ${isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : ''}`}>
                    <span className={`text-[10px] font-semibold inline-flex h-4 w-4 items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      {day.getDate()}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {drives.slice(0, 2).map(td => (
                        <div key={td.id} className={`text-[8px] rounded px-0.5 truncate font-medium ${STATUS_CAL[td.status] ?? 'bg-slate-400 text-white'}`}>
                          {(td.scheduled_time || '').substring(0, 5)} {td.customers?.full_name}
                        </div>
                      ))}
                      {drives.length > 2 && <div className="text-[8px] text-muted-foreground">+{drives.length - 2}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── YEAR VIEW ── */}
        {viewType === 'year' && (
          <div className="flex-1 p-3 grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto">
            {MONTHS_SHORT.map((mon, idx) => {
              const drives     = drivesInMonth(baseDate.getFullYear(), idx);
              const total      = drives.length;
              const completed  = drives.filter(d => d.status === 'completed').length;
              const isCurrent  = idx === new Date().getMonth() && baseDate.getFullYear() === new Date().getFullYear();
              const isSelected = insight?.type === 'month' && insight.date.getMonth() === idx && insight.date.getFullYear() === baseDate.getFullYear();
              return (
                <button key={mon} onClick={() => setInsight({ type: 'month', date: new Date(baseDate.getFullYear(), idx, 1) })}
                  className={`rounded-xl border p-2.5 text-left transition-all hover:shadow-md hover:border-primary/40 ${isSelected ? 'border-primary bg-primary/5 shadow-md' : isCurrent ? 'border-primary/30 bg-primary/[0.03]' : 'border-border bg-card'}`}>
                  <div className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{MONTHS_FULL[idx]}</div>
                  <div className="mt-1 text-xl font-black text-foreground">{total}</div>
                  <div className="text-[9px] text-muted-foreground">drives</div>
                  {total > 0 && (
                    <div className="mt-1.5 w-full h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((completed / total) * 100)}%` }} />
                    </div>
                  )}
                  {completed > 0 && <div className="mt-1 text-[8px] bg-green-100 text-green-700 rounded px-1 py-0.5 inline-block">{completed} done</div>}
                </button>
              );
            })}
            {/* Year total */}
            <button onClick={() => setInsight({ type: 'year', date: new Date(baseDate.getFullYear(), 0, 1) })}
              className={`rounded-xl border p-2.5 text-left transition-all hover:shadow-md col-span-1 ${insight?.type === 'year' ? 'border-primary bg-primary/5 shadow-md' : 'border-dashed border-border'}`}>
              <div className="text-xs font-bold text-foreground">Full Year</div>
              <div className="mt-1 text-xl font-black text-primary">{drivesInYear(baseDate.getFullYear()).length}</div>
              <div className="text-[9px] text-muted-foreground">{baseDate.getFullYear()}</div>
            </button>
          </div>
        )}
      </div>

      {/* ── Insight panel ── */}
      <div className="w-64 shrink-0 border border-border rounded-xl bg-card flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Insights
            </div>
            {insight && <div className="text-[10px] text-muted-foreground truncate max-w-[180px] mt-0.5">{insightLabel}</div>}
          </div>
          {insight && (
            <button onClick={() => { setInsight(null); setSelectedDrive(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!insight ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 opacity-20" />
            <p className="text-xs">Click a day, month, or year to see insights</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Stats */}
            <div className="p-3 grid grid-cols-2 gap-2 border-b border-border">
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="text-xl font-black text-foreground">{insightStats.total}</div>
                <div className="text-[9px] text-muted-foreground">Total</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 text-center">
                <div className="text-xl font-black text-green-600">{insightStats.byStatus.completed || 0}</div>
                <div className="text-[9px] text-muted-foreground">Completed</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 text-center">
                <div className="text-xl font-black text-blue-600">{insightStats.completionRate}%</div>
                <div className="text-[9px] text-muted-foreground">Done Rate</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2 text-center">
                <div className="text-xl font-black text-orange-500">{insightStats.byStatus.in_progress || 0}</div>
                <div className="text-[9px] text-muted-foreground">In Progress</div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="px-3 py-2 border-b border-border space-y-1.5">
              {Object.entries(insightStats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? 'bg-slate-400'}`} />
                  <span className="text-[10px] text-foreground capitalize flex-1">{status.replace(/_/g,' ')}</span>
                  <span className="text-[10px] font-semibold">{count as number}</span>
                  <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${STATUS_DOT[status] ?? 'bg-slate-400'}`} style={{ width: `${Math.round(((count as number) / insightStats.total) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Drive list */}
            <div className="px-3 py-2 flex-1">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Drives ({insightDrives.length})</p>
              <div className="space-y-1">
                {insightDrives.slice(0, 15).map(td => (
                  <button key={td.id} onClick={() => setSelectedDrive(td)}
                    className={`w-full text-left flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${selectedDrive?.id === td.id ? 'bg-primary/10' : 'hover:bg-muted/60'}`}>
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[td.status] ?? 'bg-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground truncate">{td.customers?.full_name}</p>
                      <p className="text-[9px] text-muted-foreground">{td.scheduled_date} · {(td.scheduled_time || '').substring(0,5)}</p>
                    </div>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-medium capitalize shrink-0 ${STATUS_CAL[td.status] ?? 'bg-slate-400 text-white'}`}>
                      {td.status.replace(/_/g,' ')}
                    </span>
                  </button>
                ))}
                {insightDrives.length > 15 && <p className="text-[9px] text-muted-foreground text-center py-1">+{insightDrives.length - 15} more</p>}
              </div>
            </div>

            {/* Selected drive detail */}
            {selectedDrive && (
              <div className="border-t border-border p-3 space-y-2 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{selectedDrive.customers?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedDrive.customers?.phone}</p>
                  </div>
                  <button onClick={() => setSelectedDrive(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1"><Car className="h-2.5 w-2.5 text-primary" />{selectedDrive.vehicles?.brand} {selectedDrive.vehicles?.model}</div>
                  <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5 text-primary" />{selectedDrive.scheduled_date} at {(selectedDrive.scheduled_time || '').substring(0,5)}</div>
                  <div className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5 text-primary" />{selectedDrive.locations?.name}</div>
                </div>
                <Button size="sm" className="w-full text-[10px] h-6" onClick={() => setDetailSheet(selectedDrive)}>
                  Full Details
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <TestDriveDetailSheet testDrive={detailSheet} open={!!detailSheet} onClose={() => setDetailSheet(null)} />
    </div>
  );
}
