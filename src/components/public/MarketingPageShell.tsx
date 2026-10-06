import type { ReactNode } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import SiteHeader from '@/components/SiteHeader';

type MarketingPageShellProps = {
  children: ReactNode;
  showThemeToggle?: boolean;
  brandName?: string | null;
  brandLogoUrl?: string | null;
};


export default function MarketingPageShell({
  children,
  showThemeToggle = true,
  brandName = null,
  brandLogoUrl = null,
}: MarketingPageShellProps) {
  const staffEntryPath = '/auth';
  const { resolvedTheme, toggleTheme } = useTheme();
  const brand = { dealerName: brandName, dealerLogoUrl: brandLogoUrl };

  return (
    <div className="min-h-screen bg-background text-foreground dark:text-white">
    
      <main className={`landing-main bg-background text-foreground${resolvedTheme === 'dark' ? ' dark' : ''}`}>
        {children}
      </main>

     
    </div>
  );
}
