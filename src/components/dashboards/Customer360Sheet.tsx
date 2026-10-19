import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import { buildCustomer360Summary, Customer360Item } from '@/lib/customer360';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { navigateTo } from '@/lib/browserNavigation';
import { CalendarCheck, Loader2, Mail, Phone, UserRound } from 'lucide-react';

type Customer360SheetProps = {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const Customer360Sheet = ({ customerId, open, onClose }: Customer360SheetProps) => {
  const [summary, setSummary] = useState<ReturnType<typeof buildCustomer360Summary> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    setLoading(true);
    setSummary(null);
    (async () => {
      try {
        const [customer, tdRows, commRows, eventRows] = await Promise.all([
          apiGet<any>(`/api/customers/${customerId}`),
          apiGet<any[]>(`/api/test-drives?customer_id=${encodeURIComponent(customerId)}&limit=100`),
          apiGet<any[]>(`/api/communications?customer_id=${encodeURIComponent(customerId)}&limit=100`),
          apiGet<any[]>('/api/activity/events?limit=500').catch(() => []),
        ]);
        if (cancelled) return;
        const events = (eventRows || []).filter((e: any) => e?.metadata?.customer_id === customerId);
        setSummary(buildCustomer360Summary({
          customer,
          testDrives: tdRows || [],
          communications: commRows || [],
          events,
        }));
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  const customer = summary?.customer || null;
  const drives = summary ? summary.timeline.filter((i) => i.type === 'test_drive') : [];
  const completedDrives = drives.filter((i) => String(i.status || '').includes('completed')).length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-heading">Customer 360</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customer…
          </div>
        ) : !customer ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Customer not found.</p>
        ) : (
          <div className="space-y-5 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground">{customer.full_name || 'Unnamed customer'}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone || '—'}</span>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email || '—'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Test drives</p>
                <p className="mt-1 flex items-center gap-1.5 text-xl font-heading font-bold text-foreground">
                  <CalendarCheck className="h-4 w-4 text-primary" /> {drives.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Completed</p>
                <p className="mt-1 text-xl font-heading font-bold text-foreground">{completedDrives}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Timeline</p>
              {summary && summary.timeline.length > 0 ? (
                <div className="space-y-1.5">
                  {summary.timeline.slice(0, 12).map((item: Customer360Item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {item.status && <Badge variant="outline" className="text-[9px] capitalize">{item.status}</Badge>}
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(item.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              )}
            </div>

            <Button className="w-full" variant="outline" onClick={() => navigateTo(`/customers/${customerId}`)}>
              Open full customer 360 →
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default Customer360Sheet;
