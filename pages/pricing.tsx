import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import SeoMeta from '../src/components/SeoMeta';

type BillingCycle = 'monthly' | 'yearly';

type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: string;
  yearlyPrice: string;
  cta: string;
  highlighted?: boolean;
  popular?: boolean;
  limits: {
    records: string;
    storage: string;
    email: string;
    followups: string;
  };
};

type FeatureRow = {
  label: string;
  values: Record<string, boolean | string>;
};

const plans: Plan[] = [
  {
    id: 'full',
    name: 'Full Functionality',
    tagline: 'Everything enabled for serious dealership operations',
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
    cta: 'Contact Sales',
    highlighted: true,
    limits: {
      records: 'Unlimited records',
      storage: 'Unlimited photo/document storage',
      email: 'Email setup + automation included',
      followups: 'Advanced follow-up workflows included',
    },
  },
  {
    id: 'smart1000',
    name: 'Smart 1000',
    tagline: 'Balanced package with usage cap for growing teams',
    monthlyPrice: 'AED 999',
    yearlyPrice: 'AED 9,990',
    cta: 'Choose Smart 1,000',
    popular: true,
    limits: {
      records: '1000 records total',
      storage: 'No media storage',
      email: 'No email setup',
      followups: 'Basic follow-up only',
    },
  },
  {
    id: 'starter5',
    name: 'Starter 5',
    tagline: 'Small pilot package for early adoption',
    monthlyPrice: 'Free for 1 month, then AED 199',
    yearlyPrice: 'Free for 1 month, then AED 1,990',
    cta: 'Choose Starter 5',
    limits: {
      records: '5 records in each functionality',
      storage: 'No media storage',
      email: 'No email setup',
      followups: 'No follow-up automation',
    },
  },
];

const featureRows: FeatureRow[] = [
  {
    label: 'Lead and enquiry management',
    values: { full: true, smart1000: true, starter5: true },
  },
  {
    label: 'Test drive scheduling workflow',
    values: { full: true, smart1000: true, starter5: true },
  },
  {
    label: 'Service booking management',
    values: { full: true, smart1000: true, starter5: true },
  },
  {
    label: 'Photo/document storage',
    values: { full: true, smart1000: false, starter5: false },
  },
  {
    label: 'Email setup and notifications',
    values: { full: true, smart1000: false, starter5: false },
  },
  {
    label: 'Advanced follow-up automation',
    values: { full: true, smart1000: false, starter5: false },
  },
  {
    label: 'Role-based dashboards and analytics',
    values: { full: true, smart1000: true, starter5: 'Limited' },
  },
  {
    label: 'Record creation limits',
    values: {
      full: 'Unlimited',
      smart1000: '1000 total records',
      starter5: '5 records each module',
    },
  },
];

const renderCell = (value: boolean | string) => {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center justify-center text-emerald-400">
        <Check className="h-4 w-4" />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center text-rose-300">
        <X className="h-4 w-4" />
      </span>
    );
  }

  return <span className="text-xs text-slate-600">{value}</span>;
};

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const displayPlans = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        displayPrice: billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
      })),
    [billingCycle],
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900">
      <SeoMeta
        title="AutoAdvant Pricing | Dealership Portal Subscription Packages"
        description="Compare AutoAdvant subscription packages: Full Functionality, Smart 100, and Starter 5 for dealership operations, records, storage, and automation."
        canonicalUrl="https://www.autoadvant.com/pricing"
        ogType="website"
        keywords={[
          'AutoAdvant pricing',
          'dealership software pricing',
          'online dealership portal subscription',
          'car dealership CRM package',
        ]}
      />
     <main className="mx-auto max-w-7xl px-4 py-10 sm:px-4 lg:px-4 lg:py-10">
        <div className="text-center">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            Simple plans for every dealership stage
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Choose between full enterprise functionality, a 100-record operational plan, or a 5-record starter pilot.
          </p>

          <div className="mt-8 inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === 'monthly' ? 'bg-sky-500 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === 'yearly' ? 'bg-sky-500 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {displayPlans.map((plan) => (
            <article
              key={plan.id}
              className={`rounded-3xl border p-6 shadow-2xl ${
                plan.highlighted
                  ? 'border-sky-300 bg-gradient-to-br from-sky-100 to-blue-50'
                  : 'border-slate-200 bg-white'
              } transition-transform duration-300 hover:-translate-y-1 hover:shadow-sky-900/30`}
            >
              {plan.popular ? (
                <span className="mb-3 inline-flex rounded-full border border-emerald-400/45 bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Most Popular
                </span>
              ) : null}
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{plan.name}</p>
              <p className="mt-3 text-4xl font-semibold">
                {plan.displayPrice}
                {plan.displayPrice !== 'Custom' ? (
                  <span className="ml-1 text-sm font-medium text-slate-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                ) : null}
              </p>
              <p className="mt-2 text-sm text-slate-600">{plan.tagline}</p>

              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
                  <span>{plan.limits.records}</span>
                </li>
                <li className="flex gap-2">
                  {plan.id === 'full' ? <Check className="mt-0.5 h-4 w-4 text-emerald-400" /> : <X className="mt-0.5 h-4 w-4 text-rose-300" />}
                  <span>{plan.limits.storage}</span>
                </li>
                <li className="flex gap-2">
                  {plan.id === 'full' ? <Check className="mt-0.5 h-4 w-4 text-emerald-400" /> : <X className="mt-0.5 h-4 w-4 text-rose-300" />}
                  <span>{plan.limits.email}</span>
                </li>
                <li className="flex gap-2">
                  {plan.id === 'full' ? <Check className="mt-0.5 h-4 w-4 text-emerald-400" /> : <X className="mt-0.5 h-4 w-4 text-rose-300" />}
                  <span>{plan.limits.followups}</span>
                </li>
              </ul>

              <a
                href={`/?plan=${encodeURIComponent(plan.name)}#contact`}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-sky-400 to-blue-600 text-white hover:brightness-105'
                    : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100'
                }`}
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </section>

        <section className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-900">Feature Comparison</th>
                  {displayPlans.map((plan) => (
                    <th key={plan.id} className="px-4 py-3 font-semibold text-slate-900">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 text-slate-700">{row.label}</td>
                    {displayPlans.map((plan) => (
                      <td key={`${row.label}-${plan.id}`} className="px-4 py-3 text-slate-700">
                        {renderCell(row.values[plan.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            Back to Home
          </Link>
          <a
            href="/#contact"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
          >
            Book a Sales Call
          </a>
        </div>
      </main>
    </div>
    </>
 
  );
}
