import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { navigateTo } from '@/lib/browserNavigation';
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  XCircle,
  CircleDashed,
  ClipboardList,
} from 'lucide-react';

type StatusBucketMap = Record<string, number>;

type DashboardStatusSectionsProps = {
  testDriveStatusCounts?: StatusBucketMap;
  serviceBookingStatusCounts?: StatusBucketMap;
};

const testDriveCards = [
  { key: 'scheduled', label: 'Scheduled', icon: Clock3, tint: 'bg-sky-100 text-sky-700 border-sky-200' },
  { key: 'confirmed', label: 'Confirmed', icon: CalendarCheck, tint: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'show', label: 'Show', icon: CheckCircle2, tint: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'no_show', label: 'No Show', icon: AlertTriangle, tint: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tint: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, tint: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'rescheduled', label: 'Rescheduled', icon: Clock3, tint: 'bg-orange-100 text-orange-700 border-orange-200' },
];

const serviceBookingCards = [
  { key: 'booked', label: 'Booked', icon: BookOpen, tint: 'bg-sky-100 text-sky-700 border-sky-200' },
  { key: 'confirmed', label: 'Confirmed', icon: CalendarCheck, tint: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'in_progress', label: 'In Progress', icon: CircleDashed, tint: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'ready_for_delivery', label: 'Ready for Delivery', icon: ClipboardList, tint: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tint: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, tint: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'rescheduled', label: 'Rescheduled', icon: Clock3, tint: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export function DashboardStatusSections({
  testDriveStatusCounts = {},
  serviceBookingStatusCounts = {},
}: DashboardStatusSectionsProps) {
  const handleTestDriveClick = (status: string) => {
    if (status === 'all') return;
    navigateTo(`/test-drives?status=${encodeURIComponent(status)}`);
  };

  const handleServiceBookingClick = (status: string) => {
    if (status === 'all') return;
    navigateTo(`/service-bookings?status=${encodeURIComponent(status)}`);
  };

  const handleViewAllTestDrives = () => navigateTo('/test-drives');
  const handleViewAllServiceBookings = () => navigateTo('/service-bookings');

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Test Drive Status
            </CardTitle>
            <button
              type="button"
              onClick={handleViewAllTestDrives}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              View all
            </button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {testDriveCards.map(({ key, label, icon: Icon, tint }) => {
            const count = testDriveStatusCounts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTestDriveClick(key)}
                className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer ${tint}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] font-medium opacity-80">{label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-xl font-heading font-bold">{count}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-card border-accent/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              Service Booking Status
            </CardTitle>
            <button
              type="button"
              onClick={handleViewAllServiceBookings}
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              View all
            </button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {serviceBookingCards.map(({ key, label, icon: Icon, tint }) => {
            const count = serviceBookingStatusCounts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleServiceBookingClick(key)}
                className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer ${tint}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] font-medium opacity-80">{label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-xl font-heading font-bold">{count}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
