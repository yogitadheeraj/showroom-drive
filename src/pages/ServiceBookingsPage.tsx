import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import ServiceProgressPanel from '@/components/dashboards/ServiceProgressPanel';
import { BookOpen, CalendarClock, PlusCircle } from 'lucide-react';

export default function ServiceBookingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-primary/80">
              <BookOpen className="h-4 w-4" />
              Service operations
            </p>
            <h1 className="mt-1 text-2xl font-heading font-bold text-foreground tracking-tight">
              Service Bookings
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-card">
              <CalendarClock className="h-4 w-4 text-primary" />
              Manage appointment status and technician assignments
            </div>

            <Link
              href="/service-booking"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-card transition hover:opacity-90"
            >
              <PlusCircle className="h-4 w-4" />
              Create Booking
            </Link>
          </div>
        </div>

        <ServiceProgressPanel title="Service Appointment Progress" />
      </div>
    </DashboardLayout>
  );
}
