import BookingPage from '../src/pages/BookingPage';
import MarketingPageShell from '../src/components/public/MarketingPageShell';

export default function BookRoute() {
  return (
    <MarketingPageShell>
      <BookingPage hideStandaloneHeader />
    </MarketingPageShell>
  );
}