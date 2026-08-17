import Head from 'next/head';
import Link from 'next/link';
import MarketingPageShell from '../src/components/public/MarketingPageShell';

const updatedAt = 'August 9, 2026';

export default function TermsAndConditionsPage() {
  return (
    <>
      <Head>
        <title>Terms and Conditions | AutoAdvant</title>
        <meta
          name="description"
          content="Read the AutoAdvant terms and conditions governing use of the website and platform."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.autoadvant.com/terms-and-conditions" />
      </Head>

      <MarketingPageShell>
        <div className="mx-auto max-w-4xl">
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8">
            <h1 className="text-3xl font-bold tracking-tight">Terms and Conditions</h1>
            <p className="mt-2 text-sm text-slate-600">Last updated: {updatedAt}</p>

            <p className="mt-5 leading-7">
              These Terms and Conditions govern access to and use of the AutoAdvant website and associated dealership platform services.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Acceptance of Terms</h2>
            <p className="mt-3 leading-7">
              By using this website or platform, you agree to these terms. If you do not agree, do not use the services.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Use of Services</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
              <li>You agree to provide accurate information when using booking and communication forms.</li>
              <li>You agree not to misuse, disrupt, or attempt unauthorized access to the platform.</li>
              <li>You are responsible for compliance with applicable local laws and regulations.</li>
            </ul>

            <h2 className="mt-8 text-xl font-semibold">Intellectual Property</h2>
            <p className="mt-3 leading-7">
              All platform content, branding, software, and documentation are owned by AutoAdvant or its licensors unless otherwise stated.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Service Availability</h2>
            <p className="mt-3 leading-7">
              We may modify, suspend, or discontinue features at any time for maintenance, upgrades, security, or operational reasons.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Limitation of Liability</h2>
            <p className="mt-3 leading-7">
              To the maximum extent permitted by law, AutoAdvant is not liable for indirect, incidental, special, or consequential damages arising from service use.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Third-Party Services</h2>
            <p className="mt-3 leading-7">
              Some features may rely on third-party providers (for messaging, analytics, hosting, maps, and payments). Their terms may also apply.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Changes to Terms</h2>
            <p className="mt-3 leading-7">
              We may update these terms periodically. Continued use after updates means you accept the revised terms.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Contact</h2>
            <p className="mt-3 leading-7">
              For questions about these terms, contact us at{' '}
              <a className="text-sky-700 hover:underline" href="mailto:autoadvantplatform@gmail.com">
                autoadvantplatform@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </MarketingPageShell>
    </>
  );
}
