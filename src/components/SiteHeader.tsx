import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SiteHeaderProps {
  variant?: 'landing' | 'app';
  showNav?: boolean;
  rightSlot?: React.ReactNode;
}

const SiteHeader = ({ variant = 'landing', showNav = true, rightSlot }: SiteHeaderProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setIsLoggedIn(!!session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const staffEntryPath = isLoggedIn ? '/dashboard' : '/auth';

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[hsl(220,50%,10%)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/images/autoadvant-logo.png" alt="AutoAdvant" className="h-9 sm:h-10 w-auto" />
        </Link>

        {showNav && variant === 'landing' && (
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="/#features" className="transition hover:text-white">Features</a>
            <a href="/#benefits" className="transition hover:text-white">Benefits</a>
            <a href="/#contact" className="transition hover:text-white">Contact</a>
            <Link to="/dealer-onboarding" className="transition hover:text-white">Dealer Onboarding</Link>
            <Link to="/compare" className="transition hover:text-white">Compare Vehicles</Link>
            <Link to={staffEntryPath} className="transition hover:text-white">Staff Login</Link>
          </nav>
        )}

        <div className="flex items-center gap-3">
          {rightSlot}
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
