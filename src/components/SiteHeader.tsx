import { useAuthOptional } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { LogOut, Moon, Sun } from 'lucide-react';
import { navigateTo } from '@/lib/browserNavigation';

interface SiteHeaderProps {
  variant?: 'landing' | 'app';
  showNav?: boolean;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
  dealerName?: string | null;
  dealerLogoUrl?: string | null;
  showLogo?: boolean;
}

const SiteHeader = ({ showLogo=true, variant = 'landing', showNav = true, rightSlot, leftSlot, dealerName, dealerLogoUrl }: SiteHeaderProps) => {
  const auth = useAuthOptional();
  const isLoggedIn = !!auth?.user;
  const { resolvedTheme, toggleTheme } = useTheme();

  const staffEntryPath = isLoggedIn ? '/dashboard' : '/auth';

  const handleSignOut = async () => {
    if (!auth?.signOut) return;
    try {
      await auth.signOut();
      navigateTo('/auth');
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 text-foreground backdrop-blur dark:border-white/10 dark:bg-[hsl(220,50%,10%)]/95 dark:text-slate-100">
      <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {leftSlot}
         {showLogo && (
            <a href="/" className="flex items-center shrink-0">
            {(dealerLogoUrl || dealerName) ? (
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-2">
                  {dealerLogoUrl && (
                    <img
                      src={dealerLogoUrl}
                      alt={dealerName || 'Dealer'}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  )}
                  {dealerName && (
                    <span className={resolvedTheme === 'dark' ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-foreground'}>
                      {dealerName}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground dark:text-slate-500 mt-0.5">
                  Powered by{' '}
                  <a
                    href="https://autoadvant.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-muted-foreground dark:text-slate-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    AutoAdvant.com
                  </a>
                </span>
              </div>
            ) : (
              <img
                src={ resolvedTheme === 'dark'  ? '/images/autoadvant-logo.png' : '/images/autoadvant-peaked-horizontal-dark.png'}
                alt="AutoAdvant"
                className="h-9 w-auto object-contain"
              />
            )}
          </a>
          )}
        </div>

        {showNav && variant === 'landing' && (
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex dark:text-slate-300">
            <a href="/#features" className="transition hover:text-foreground dark:hover:text-white">Features</a>
            <a href="/#benefits" className="transition hover:text-foreground dark:hover:text-white">Benefits</a>
            <a href="/#contact" className="transition hover:text-foreground dark:hover:text-white">Contact</a>
            <a href="/dealer-onboarding" className="transition hover:text-foreground dark:hover:text-white">Entity Onboarding</a>
            <a href="/compare" className="transition hover:text-foreground dark:hover:text-white">Compare Vehicles</a>
            <a href={staffEntryPath} className="transition hover:text-foreground dark:hover:text-white">Staff Login</a>
          </nav>
        )}

        <div className="flex items-center gap-3">
          {rightSlot}
          {variant === 'app' && isLoggedIn && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition hover:bg-muted/70 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition hover:bg-muted/70 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {variant === 'landing' && (
            <a
              href="/#contact"
              className="rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]"
            >
              Book Demo
            </a>
          )}
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
