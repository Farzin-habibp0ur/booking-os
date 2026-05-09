import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  ClipboardList,
  MessageSquareText,
  TrendingUp,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pilot Pricing — Business Command Centre',
  description:
    'Pilot pricing for Business Command Centre, the AI front desk for aesthetic clinics.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/pricing',
  },
};

const INCLUDED = [
  {
    icon: MessageSquareText,
    title: 'Channel intake',
    body: 'Instagram, WhatsApp, website chat, SMS, and email are scoped during onboarding.',
  },
  {
    icon: ClipboardList,
    title: 'Approval-first replies',
    body: 'AI drafts are reviewed by staff before sending during the pilot.',
  },
  {
    icon: TrendingUp,
    title: 'Recovered revenue reporting',
    body: 'Track captured leads, approved drafts, attributed bookings, and estimated recovered revenue.',
  },
];

const FAQ = [
  {
    q: 'Why no public plan table?',
    a: 'The pilot is intentionally scoped to clinic size, channel setup, and workflow complexity. Fixed public plans come after the pilot proves the right packaging.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'Pilot terms are confirmed before onboarding. The goal is to prove recovered revenue before expanding usage.',
  },
  {
    q: 'What affects pilot pricing?',
    a: 'The number of connected channels, locations, staff workflows, and reporting requirements all affect the pilot scope.',
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="px-5 pb-16 pt-28 text-center sm:px-8 sm:pt-32">
        <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">
          Pilot pricing
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          Pricing is confirmed during onboarding.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-500">
          Business Command Centre is being introduced as an AI Front Desk pilot for aesthetic
          clinics. Pricing depends on clinic size, connected channels, and the front desk workflows
          you want to prove first.
        </p>
        <Link
          href="/pilot"
          className="btn-press mt-8 inline-flex items-center gap-2 rounded-xl bg-sage-600 px-7 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sage-700"
        >
          Apply for Pilot
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {INCLUDED.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl bg-white p-6 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender-50 text-lavender-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <h2 className="font-serif text-3xl font-bold text-slate-900">Pilot scope includes</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              'Clinic front desk workflow review',
              'Channel connection plan',
              'Clinic voice and approval-mode setup',
              'Cancellation and waitlist workflow configuration',
              'Consult follow-up tracking',
              'Recovered revenue summary',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 shrink-0 text-sage-600" />
                <span className="text-sm font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="text-center font-serif text-3xl font-bold text-slate-900">
          Pricing questions
        </h2>
        <div className="mt-8 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl bg-white p-6 shadow-soft">
              <h3 className="text-base font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
