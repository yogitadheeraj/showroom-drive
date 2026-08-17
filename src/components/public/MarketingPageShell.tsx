import type { ReactNode } from 'react';
import Link from 'next/link';

type MarketingPageShellProps = {
  children: ReactNode;
};

export default function MarketingPageShell({ children }: MarketingPageShellProps) {
  const staffEntryPath = '/auth';
  const resolvedTheme = 'dark';
  const brand = { dealerName: null as string | null, dealerLogoUrl: null as string | null };

  return (
    <div className="min-h-screen bg-background text-foreground dark:text-white">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 text-foreground backdrop-blur dark:border-white/10 dark:bg-[hsl(220,50%,10%)]/95 dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center shrink-0">
            {(brand.dealerLogoUrl || brand.dealerName) ? (
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-2">
                  {brand.dealerLogoUrl && (
                    <img
                      src={brand.dealerLogoUrl}
                      alt={brand.dealerName || 'Dealer'}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  )}
                  {brand.dealerName && (
                    <span className="text-sm font-semibold text-white">{brand.dealerName}</span>
                  )}
                </div>
              </div>
            ) : (
              <img
                src={resolvedTheme === 'dark' ? '/images/autoadvant-logo.png' : '/images/autoadvant-peaked-horizontal-dark.png'}
                alt="AutoAdvant"
                className="h-9 w-auto object-contain"
              />
            )}
          </a>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex dark:text-slate-300">
            <a href="/#features" className="transition hover:text-foreground dark:hover:text-white">Features</a>
            <a href="/#benefits" className="transition hover:text-foreground dark:hover:text-white">Benefits</a>
            <a href="/#contact" className="transition hover:text-foreground dark:hover:text-white">Contact</a>
            <Link href="/dealer-onboarding" className="transition hover:text-foreground dark:hover:text-white">Entity Onboarding</Link>
            <Link href="/compare" className="transition hover:text-foreground dark:hover:text-white">Compare Vehicles</Link>
            <Link href={staffEntryPath} className="transition hover:text-foreground dark:hover:text-white">Staff Login</Link>
          </nav>

          <a
            href="/#contact"
            className="rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]"
          >
            Book Demo
          </a>
        </div>
      </header>

      <main className={`landing-main bg-background text-foreground${resolvedTheme === 'dark' ? ' dark' : ''}`}>
        {children}
      </main>

      <footer className="border-t border-border bg-red backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto grid max-w-7xl gap-6 px-2 py-2 sm:px-6 md:grid-cols-[auto,1fr,auto] md:items-center">
          <a href="/" className="mx-auto md:mx-0">
            <div className="flex items-center justify-center md:justify-start">
              <img src="/images/autoadvant-logo.png" alt="AutoAdvant logo" className="h-11 w-auto" />
            </div>
          </a>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-5">
            <Link href="/dealer-onboarding" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Entity Onboarding</Link>
            <Link href="/compare" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Compare Vehicles</Link>
            <Link href={staffEntryPath} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Staff Login</Link>
            <a href="/privacy-policy" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Terms & Conditions</a>
            <a href="/sitemap" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sitemap</a>
          </div>

          <p className="text-center text-xs text-muted-foreground md:text-right">© {new Date().getFullYear()} AutoAdvant</p>
        </div>
      </footer>
    </div>
  );
}
