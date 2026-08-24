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
const DEFAULT_TITLE = 'AutoAdvant | Car Dealership CRM, Test Drive & Service Booking Software in Dubai, UAE, KSA & GCC';
const DEFAULT_DESCRIPTION =
  'AutoAdvant is automotive dealership software for BMW, Audi, Mercedes-Benz, Toyota, Honda, Porsche, Lexus, Nissan, Range Rover, Volvo, and other car brands. Manage leads, test drives, service bookings, inventory, and showroom operations in Dubai, UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, and globally.';
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
          content="AutoAdvant, automotive CRM, dealership CRM, car dealership software, test drive booking software, service booking platform, BMW dealership software, Audi dealership CRM, Mercedes-Benz showroom software, Toyota CRM, Honda dealer system, Dubai automotive software, UAE car dealership CRM, KSA dealership software, GCC automotive platform, global car showroom management, vehicle sales CRM, auto leads management"
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
      {/* Google Tag Manager */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-MZFMTRFP');`,
        }}
      />
      {/* End Google Tag Manager */}
      {/* Google tag (gtag.js) */}
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-QSBYHHR3H1"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QSBYHHR3H1');
          `,
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
