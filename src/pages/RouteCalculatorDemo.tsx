import RouteCalculator from '@/components/RouteCalculator';
import { Car, Navigation } from 'lucide-react';

/**
 * Demo page — accessible at /demo/route
 * Shows the RouteCalculator with a real showroom origin (Bandra, Mumbai).
 * Remove this file once you've verified the feature in the real app.
 */
export default function RouteCalculatorDemo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <Car className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">AutoAdvant — Route Calculator Demo</p>
            <p className="text-xs text-muted-foreground">Showroom: Bandra West, Mumbai</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* Info card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            How it works
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 mt-2 list-disc list-inside">
            <li>Type any destination address in the search box</li>
            <li>Suggestions load automatically via OpenStreetMap</li>
            <li>Click a suggestion → round-trip distance &amp; estimated time is calculated via OSRM</li>
            <li>No API key required — 100% free</li>
          </ul>
        </div>

        {/* Booking summary mock */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">BMW 3 Series — Test Drive</p>
              <p className="text-xs text-muted-foreground">AutoAdvant Showroom, Bandra West, Mumbai · 11 Jun 2026 · 10:30 AM</p>
            </div>
          </div>

          <hr className="border-border" />

          {/* Route Calculator embedded */}
          <RouteCalculator
            originLat="19.0596"
            originLng="72.8295"
            originName="AutoAdvant Bandra Showroom"
            onRoute={(route) => {
              if (route) {
                console.log('[Demo] Route calculated:', route);
              }
            }}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          In the real app this appears in the <strong>Walk-in Dialog → Confirm step</strong> and on the <strong>Customer Booking page</strong>.
        </p>
      </div>
    </div>
  );
}
