import '../src/index.css';
import HeaderComponents from '@/components/common/HeaderComponents';
import FooterComponent from '@/components/common/FooterComponent';
import { useEffect, useState } from 'react';
import Head from 'next/head';
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
import { firebaseAuth, isFirebaseClientConfigured } from '@/integrations/supabase/client';
import { onAuthStateChanged } from 'firebase/auth';

const queryClient = new QueryClient();
const SITE_URL = 'https://www.autoadvant.com';
const DEFAULT_TITLE = 'AutoAdvant | Automotive Dealership CRM and Test Drive Platform';
const DEFAULT_DESCRIPTION =
  'AutoAdvant helps automotive dealerships manage leads, schedule test drives, and improve sales operations with real-time insights.';
const DEFAULT_OG_IMAGE = 'https://www.autoadvant.com/images/autoadvant-logo.png';

const SHOW_HEADER_ROUTES = [
  '/',
  '/book',
  '/brands',
  '/compare',
  '/service-booking',
  '/privacy-policy',
  '/terms-and-conditions',
  '/sitemap',
  '/walkin',
  '/contact',
  '/demo/route',
];

const HIDE_HEADER_ROUTES = [
  '/auth',
  '/auth/login',
  '/auth/register',
  '/dashboard',
  '/settings',
  '/settings/brands',
  '/users',
  '/vehicles',
  '/test-drives',
  '/service-bookings',
  '/car-bookings',
  '/enquiries',
  '/fleet',
  '/follow-ups',
  '/incoming-vehicles',
  '/waiting-board',
  '/communications',
  '/activity-logs',
  '/reports',
  '/data-center',
  '/my-profile',
  '/dealer-onboarding',
  '/customer',
  '/bookings',
  '/location',
  '/locations',
];

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const canonicalPath = (router.asPath || '/').split('?')[0] || '/';
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (!firebaseAuth || !isFirebaseClientConfigured) {
      setIsLoggedIn(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setIsLoggedIn(!!user);
    });

    return () => unsubscribe();
  }, []);

  const currentPath = router.pathname || '/';
  const shouldHideHeader =
    HIDE_HEADER_ROUTES.some((route) => currentPath === route || currentPath.startsWith(`${route}/`)) ||
    currentPath.startsWith('/customer/');
  const shouldShowHeader =
    SHOW_HEADER_ROUTES.includes(currentPath) && !shouldHideHeader;
  const shouldRenderHeaderFooter = shouldShowHeader;

  const globalSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'AutoAdvant',
      url: SITE_URL,
      logo: DEFAULT_OG_IMAGE,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AutoAdvant',
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'AutoAdvant',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
    },
  ];

  useEffect(() => {
    setNavigationRouter(router);

    return () => {
      setNavigationRouter(null);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>{DEFAULT_TITLE}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <meta
          name="keywords"
          content="automotive crm, dealership crm, test drive booking, showroom management, lead management"
        />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="theme-color" content="#0f172a" />

        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="AutoAdvant" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:image:alt" content="AutoAdvant platform" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={DEFAULT_TITLE} />
        <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />

        <link rel="canonical" href={canonicalUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(globalSchema),
          }}
        />
      </Head>
      <ThemeProvider>
        <WhitelabelProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <DealerContextProvider>
                {shouldRenderHeaderFooter && <HeaderComponents isLoggedIn={isLoggedIn} />}
                <Component {...pageProps} />
                {shouldRenderHeaderFooter && <FooterComponent />}
              </DealerContextProvider>
            </AuthProvider>
          </TooltipProvider>
        </WhitelabelProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
