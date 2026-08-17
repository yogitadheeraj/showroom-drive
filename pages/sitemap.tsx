import Head from 'next/head';
import Link from 'next/link';
import MarketingPageShell from '../src/components/public/MarketingPageShell';

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/book', label: 'Book Test Drive' },
  { href: '/compare', label: 'Compare Vehicles' },
  { href: '/dealer-onboarding', label: 'Dealer Onboarding' },
  { href: '/auth', label: 'Staff Login' },
  { href: '/unsubscribe', label: 'Unsubscribe' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-and-conditions', label: 'Terms and Conditions' },
  { href: '/sitemap.xml', label: 'XML Sitemap' },
];

export default function HtmlSitemapPage() {
  return (
    <>
      <Head>
        <title>HTML Sitemap | AutoAdvant</title>
        <meta name="description" content="HTML sitemap for AutoAdvant public pages." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.autoadvant.com/sitemap" />
      </Head>

      <MarketingPageShell>
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8">
            <h1 className="text-3xl font-bold tracking-tight">HTML Sitemap</h1>
            <p className="mt-2 text-sm text-slate-600">Public pages and SEO resources.</p>

            <ul className="mt-6 list-disc space-y-2 pl-6 text-sky-700">
              {PUBLIC_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </MarketingPageShell>
    </>
  );
}
