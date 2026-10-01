import { Link } from 'react-router-dom';
import { useAuthOptional } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Globe, LogOut, MapPin, Moon, Sun, UserRound } from 'lucide-react';
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
  const isLanding = variant === 'landing';

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
    <header className={isLanding ? 'sticky top-0 z-30 px-3 pt-6 text-foreground sm:px-5 lg:px-8' : 'sticky top-0 z-30 px-3 pt-3 text-foreground sm:px-5 lg:px-8'}>
      <div
        className={
          isLanding
            ? 'mx-auto flex w-full max-w-[1320px] items-center justify-between gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-[0_8px_26px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 sm:px-7'
            : 'mx-auto flex w-full items-center justify-between gap-3 rounded-3xl border border-white/45 bg-gradient-to-r from-slate-100/85 via-white/80 to-amber-100/75 px-4 py-3 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/85 dark:via-slate-900/80 dark:to-slate-800/75 dark:text-slate-100 sm:px-6'
        }
      >
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
                  src={resolvedTheme === 'dark' ? '/images/autoadvant-logo.png' : '/images/autoadvant-peaked-horizontal-dark.png'}
                  alt="AutoAdvant"
                  className={isLanding ? 'h-7 w-auto object-contain' : 'h-9 w-auto object-contain'}
                />
              )}
            </a>
          )}
          {variant === 'app' && (
            <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm md:flex">
              <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_12px_hsl(var(--success)/0.55)]" />
              Operations Center
            </div>
          )}
        </div>

        {showNav && variant === 'landing' && (
          <nav className="hidden items-center gap-7 text-[15px] font-medium text-slate-700 md:flex dark:text-slate-300">
            <a href="/#features" className="transition hover:text-slate-950 dark:hover:text-white">Features</a>
            <a href="/#benefits" className="transition hover:text-slate-950 dark:hover:text-white">Benefits</a>
            <a href="/#contact" className="transition hover:text-slate-950 dark:hover:text-white">Contact</a>
            <Link to="/dealer-onboarding" className="transition hover:text-slate-950 dark:hover:text-white">Entity Onboarding</Link>
            <Link to="/compare" className="transition hover:text-slate-950 dark:hover:text-white">Compare Vehicles</Link>
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
            className={
              isLanding
                ? 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                : 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-foreground transition hover:bg-muted/70 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10'
            }
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {variant === 'landing' && (
            <>
              <a
                href="/#contact"
                aria-label="Location"
                title="Our locations"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <MapPin className="h-4 w-4" />
              </a>
              <a
                href="https://autoadvant.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Website"
                title="AutoAdvant website"
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:inline-flex"
              >
                <Globe className="h-4 w-4" />
              </a>
              <Link
                to={staffEntryPath}
                aria-label="Staff login"
                title="Staff login"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <UserRound className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
