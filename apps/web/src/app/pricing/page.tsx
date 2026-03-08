'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Minus, ChevronDown } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const plans = [
  {
    key: 'starter' as const,
    name: 'Starter',
    tagline: 'For solo practitioners',
    monthlyPrice: 49,
    annualPrice: 39,
    features: [
      'Up to 1 provider',
      '100 bookings/month',
      'Basic scheduling',
      'Client management',
      'Email notifications',
      'Standard support',
    ],
    highlighted: false,
  },
  {
    key: 'professional' as const,
    name: 'Professional',
    tagline: 'For growing clinics',
    monthlyPrice: 99,
    annualPrice: 79,
    features: [
      'Up to 5 providers',
      'Unlimited bookings',
      'Everything in Starter plus:',
      'WhatsApp inbox',
      'AI automation (all 5 agents)',
      'Advanced analytics',
      'Custom branding',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    key: 'enterprise' as const,
    name: 'Enterprise',
    tagline: 'For multi-location businesses',
    monthlyPrice: 199,
    annualPrice: 159,
    features: [
      'Unlimited providers',
      'Everything in Professional plus:',
      'Multi-location management',
      'API access',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    highlighted: false,
  },
];

interface FeatureRow {
  label: string;
  starter: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

interface FeatureCategory {
  category: string;
  rows: FeatureRow[];
}

const comparisonData: FeatureCategory[] = [
  {
    category: 'Scheduling',
    rows: [
      { label: 'Online booking', starter: true, professional: true, enterprise: true },
      { label: 'Calendar sync', starter: true, professional: true, enterprise: true },
      { label: 'Waitlist', starter: false, professional: true, enterprise: true },
      { label: 'Recurring appointments', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'Client Management',
    rows: [
      { label: 'Client profiles', starter: true, professional: true, enterprise: true },
      { label: 'Visit history', starter: true, professional: true, enterprise: true },
      { label: 'Custom fields', starter: false, professional: true, enterprise: true },
      { label: 'Client segments', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'Communication',
    rows: [
      { label: 'Email notifications', starter: true, professional: true, enterprise: true },
      { label: 'WhatsApp inbox', starter: false, professional: true, enterprise: true },
      { label: 'Message templates', starter: false, professional: true, enterprise: true },
      { label: 'Auto-replies', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'AI & Automation',
    rows: [
      { label: 'Intent detection', starter: false, professional: true, enterprise: true },
      { label: 'Booking assistant', starter: false, professional: true, enterprise: true },
      { label: '5 background agents', starter: false, professional: true, enterprise: true },
      { label: 'AI auto-reply', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'Analytics',
    rows: [
      { label: 'Dashboard', starter: true, professional: true, enterprise: true },
      { label: 'Custom reports', starter: false, professional: true, enterprise: true },
      { label: 'Revenue tracking', starter: false, professional: true, enterprise: true },
      { label: 'AI insights', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'Billing',
    rows: [
      { label: 'Invoices', starter: true, professional: true, enterprise: true },
      { label: 'Deposit collection', starter: false, professional: true, enterprise: true },
      { label: 'Stripe integration', starter: true, professional: true, enterprise: true },
      { label: 'Payment links', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'Support',
    rows: [
      { label: 'Email support', starter: true, professional: true, enterprise: true },
      { label: 'Priority support', starter: false, professional: true, enterprise: true },
      { label: 'Dedicated account manager', starter: false, professional: false, enterprise: true },
    ],
  },
];

const faqs = [
  {
    question: 'Can I change plans later?',
    answer:
      'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. When upgrading, you will be prorated for the remainder of your billing cycle. When downgrading, the change takes effect at the start of your next billing period.',
  },
  {
    question: 'What happens when my trial ends?',
    answer:
      'At the end of your 14-day free trial, you will be prompted to choose a plan and enter payment details. If you do not subscribe, your account will be paused but your data will be preserved for 30 days so you can pick up right where you left off.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      'Yes. If you are not satisfied within the first 30 days of a paid subscription, contact us and we will issue a full refund — no questions asked.',
  },
  {
    question: 'Is there a setup fee?',
    answer:
      'No. There are no setup fees, hidden charges, or contracts. You only pay the monthly or annual subscription price listed above.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer:
      'Yes. All plans are 20% cheaper when billed annually. Toggle the billing switch above to see the discounted prices.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards (Visa, Mastercard, American Express) through our payment partner Stripe. For Enterprise plans, we can also arrange invoice-based billing.',
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CellIcon({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-slate-700">{value}</span>;
  }
  if (value) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage-50">
        <Check className="w-3.5 h-3.5 text-sage-600" />
      </span>
    );
  }
  return <Minus className="w-4 h-4 text-slate-300" />;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-base font-medium text-slate-800 group-hover:text-sage-700 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 ml-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <p className="pb-5 text-slate-500 text-sm leading-relaxed -mt-1">{answer}</p>}
    </div>
  );
}

function ComparisonCategory({ category }: { category: FeatureCategory }) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="pt-8 pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider"
        >
          {category.category}
        </td>
      </tr>
      {category.rows.map((row) => (
        <tr key={row.label} className="border-b border-slate-50">
          <td className="py-3.5 pr-4 text-slate-700">{row.label}</td>
          <td className="py-3.5 px-4 text-center">
            <div className="flex justify-center">
              <CellIcon value={row.starter} />
            </div>
          </td>
          <td className="py-3.5 px-4 text-center">
            <div className="flex justify-center">
              <CellIcon value={row.professional} />
            </div>
          </td>
          <td className="py-3.5 px-4 text-center">
            <div className="flex justify-center">
              <CellIcon value={row.enterprise} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FCFCFD' }}>
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-slate-900">
            Booking OS
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-sage-600 hover:bg-sage-700 px-4 py-2 rounded-xl transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="pt-20 pb-12 text-center px-4">
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-slate-900 mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          All plans include a 14-day free trial. No credit card required.
        </p>

        {/* ---- Billing toggle ---- */}
        <div className="mt-10 inline-flex items-center gap-3 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              !annual
                ? 'bg-white text-slate-900 shadow-soft-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              annual
                ? 'bg-white text-slate-900 shadow-soft-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Annual{' '}
            <span className="ml-1 text-xs font-semibold text-sage-600 bg-sage-50 px-1.5 py-0.5 rounded-md">
              Save 20%
            </span>
          </button>
        </div>
      </section>

      {/* ---- Pricing cards ---- */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const monthlySavings = plan.monthlyPrice - plan.annualPrice;
            return (
              <div
                key={plan.key}
                className={`relative bg-white rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? 'border-2 border-sage-500 shadow-soft-lg md:scale-105 z-10'
                    : 'border border-slate-200 shadow-soft'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-sage-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="font-serif text-xl font-semibold text-slate-900">{plan.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{plan.tagline}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="font-serif text-4xl font-semibold text-slate-900">${price}</span>
                  <span className="text-slate-500 text-sm mb-1">/mo</span>
                </div>
                {annual && (
                  <p className="text-xs text-sage-600 mt-1">Save ${monthlySavings * 12}/year</p>
                )}

                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-sage-500 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/signup?plan=${plan.key}`}
                  className={`mt-8 block text-center text-sm font-medium py-3 rounded-xl transition-colors ${
                    plan.highlighted
                      ? 'bg-sage-600 hover:bg-sage-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  Start Free Trial
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Feature comparison table ---- */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="font-serif text-3xl font-semibold text-slate-900 text-center mb-12">
          Compare plans in detail
        </h2>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 pr-4 font-medium text-slate-500 w-1/3">Feature</th>
                <th className="text-center py-4 px-4 font-medium text-slate-500">Starter</th>
                <th className="text-center py-4 px-4 font-medium text-slate-500">
                  <span className="text-sage-700">Professional</span>
                </th>
                <th className="text-center py-4 px-4 font-medium text-slate-500">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((cat) => (
                <ComparisonCategory key={cat.category} category={cat} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile comparison (stacked cards) */}
        <div className="md:hidden space-y-10">
          {comparisonData.map((cat) => (
            <div key={cat.category}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                {cat.category}
              </h3>
              <div className="space-y-3">
                {cat.rows.map((row) => (
                  <div key={row.label} className="bg-white rounded-xl p-4 shadow-soft-sm">
                    <p className="text-sm font-medium text-slate-800 mb-3">{row.label}</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-slate-400 mb-1">Starter</p>
                        <div className="flex justify-center">
                          <CellIcon value={row.starter} />
                        </div>
                      </div>
                      <div>
                        <p className="text-sage-600 mb-1 font-medium">Pro</p>
                        <div className="flex justify-center">
                          <CellIcon value={row.professional} />
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Enterprise</p>
                        <div className="flex justify-center">
                          <CellIcon value={row.enterprise} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="font-serif text-3xl font-semibold text-slate-900 text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="bg-white rounded-2xl shadow-soft p-6 sm:p-8">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="text-center pb-24 px-4">
        <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-3">
          Still have questions?
        </h2>
        <p className="text-slate-500 mb-6">Our team is happy to help you find the right plan.</p>
        <a
          href="mailto:hello@bookingos.com"
          className="inline-block text-sm font-medium text-sage-600 hover:text-sage-700 border border-sage-200 hover:border-sage-300 px-6 py-3 rounded-xl transition-colors"
        >
          Contact us
        </a>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="font-serif text-lg font-semibold text-slate-900">
              Booking OS
            </Link>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/pricing" className="hover:text-slate-700 transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="hover:text-slate-700 transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="hover:text-slate-700 transition-colors">
                Sign Up
              </Link>
            </div>
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Booking OS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
