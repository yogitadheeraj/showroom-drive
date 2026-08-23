import { useEffect, useState } from 'react';
import Link from 'next/link';

import { useToast } from '@/hooks/use-toast';
import { Moon, Sun } from 'lucide-react';
import { useWhitelabel } from '@/hooks/useWhitelabel';

const HeaderComponents = ({isLoggedIn}) => {
  const { toast } = useToast();
  const brand = useWhitelabel();
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const resolvedTheme = mounted ? (isDarkMode ? 'dark' : 'light') : 'dark';
    const toggleTheme = () => setIsDarkMode((prev) => !prev);
    const staffEntryPath = '/dashboard';
    const THEME_STORAGE_KEY = 'autoadvant-theme';

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!mounted) return;
        document.documentElement.classList.toggle('dark', isDarkMode);
        document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
        localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
       const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const nextDark = savedTheme ? savedTheme === 'dark' : prefersDark;
        document.documentElement.classList.toggle('dark', nextDark);
        document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    }, [mounted, isDarkMode]);
  
    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const nextDark = savedTheme ? savedTheme === 'dark' : prefersDark;
        setIsDarkMode(nextDark);
        document.documentElement.classList.toggle('dark', nextDark);
        document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    }, []);
  return (
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 text-foreground backdrop-blur dark:border-white/10 dark:bg-[hsl(220,50%,10%)]/95 dark:text-slate-100">
                            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-6">
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
                                    <Link href="/service-booking" className="transition hover:text-foreground dark:hover:text-white">Book A Service</Link>
                                    <Link href="/dealer-onboarding" className="transition hover:text-foreground dark:hover:text-white">Entity Onboarding</Link>
                                    <Link href={isLoggedIn ? staffEntryPath : '/auth'} className="transition hover:text-foreground dark:hover:text-white">{isLoggedIn ? 'Dashboard' : 'Staff Login'}</Link>
                                </nav>
                                
                             
                                <a
                                    href="/compare"
                                    className="rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]"
                                >
                                   Compare Vehicles
                                </a>
                                 <a
                                    href="/#contact"
                                    className="rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]"
                                >
                                    Book Demo
                                </a>
                                   <button
                                    type="button"
                                    onClick={toggleTheme}
                                    aria-label="Toggle theme"
                                    title={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition hover:bg-muted/70 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                                >
                                    {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                </button>
                            </div>
                        </header>
  );
};

export default HeaderComponents;
