import '../src/index.css';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '../src/components/ui/sonner';
import { Toaster } from '../src/components/ui/toaster';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { AuthProvider } from '../src/hooks/useAuth';
import { ThemeProvider } from '../src/hooks/useTheme';
import { DealerContextProvider } from '../src/hooks/useDealerContext';
import { WhitelabelProvider } from '../src/hooks/useWhitelabel';
import { setNavigationRouter } from '../src/lib/browserNavigation';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    setNavigationRouter(router);

    return () => {
      setNavigationRouter(null);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WhitelabelProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <DealerContextProvider>
                <Component {...pageProps} />
              </DealerContextProvider>
            </AuthProvider>
          </TooltipProvider>
        </WhitelabelProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
