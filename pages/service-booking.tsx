import MarketingPageShell from '../src/components/public/MarketingPageShell';
import ServiceBookingPage from '../src/pages/ServiceBookingPage';

export default function ServiceBookingRoute() {
  return (
    <MarketingPageShell>
      <ServiceBookingPage />
    </MarketingPageShell>
  );
}
