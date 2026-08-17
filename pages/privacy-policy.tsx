import Head from 'next/head';
import Link from 'next/link';
import MarketingPageShell from '../src/components/public/MarketingPageShell';

const updatedAt = 'August 9, 2026';

export default function PrivacyPolicyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy | AutoAdvant</title>
        <meta
          name="description"
          content="Read the AutoAdvant privacy policy for details on data collection, usage, and protection."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.autoadvant.com/privacy-policy" />
      </Head>

      <MarketingPageShell>
        <div className="mx-auto max-w-4xl">
    
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8">
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm text-slate-600">Last updated: {updatedAt}</p>

            <p className="mt-5 leading-7">
              AutoAdvant respects your privacy and is committed to protecting personal information collected through our website and dealership platform.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Information We Collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
              <li>Contact details such as name, email address, and phone number.</li>
              <li>Booking details such as preferred vehicle, location, date, and time.</li>
              <li>Usage and technical data such as browser type, IP address, and pages visited.</li>
            </ul>

            <h2 className="mt-8 text-xl font-semibold">How We Use Information</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
              <li>To process test-drive bookings and customer requests.</li>
              <li>To send transactional updates, reminders, and service communications.</li>
              <li>To improve product performance, reliability, and user experience.</li>
            </ul>

            <h2 className="mt-8 text-xl font-semibold">Data Sharing</h2>
            <p className="mt-3 leading-7">
              We may share data with authorized dealership partners and trusted service providers that help us deliver communication, hosting, analytics, and support services.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Data Security</h2>
            <p className="mt-3 leading-7">
              We use reasonable administrative, technical, and organizational safeguards to protect personal information against unauthorized access, loss, misuse, or disclosure.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Data Retention</h2>
            <p className="mt-3 leading-7">
              We retain personal information for as long as needed to provide services, satisfy legal obligations, resolve disputes, and enforce agreements.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Your Rights</h2>
            <p className="mt-3 leading-7">
              You may request access, correction, or deletion of your personal information, subject to applicable legal requirements.
            </p>

            <h2 className="mt-8 text-xl font-semibold">Contact</h2>
            <p className="mt-3 leading-7">
              For privacy-related requests, contact us at{' '}
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
