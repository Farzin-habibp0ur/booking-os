import type { Metadata } from 'next';
import Link from 'next/link';
import FaqItem from '@/components/faq-item';

export const metadata: Metadata = {
  title: 'FAQ — Business Command Centre',
  description:
    'Frequently asked questions about Business Command Centre, the AI front desk for aesthetic clinics.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/faq',
  },
};

const FAQ_CATEGORIES = [
  {
    title: 'Pilot',
    items: [
      {
        q: 'What is Business Command Centre?',
        a: 'Business Command Centre is an AI front desk for aesthetic clinics. It helps your team respond faster to leads, follow up consults, fill cancellations, and track recovered revenue.',
      },
      {
        q: 'Who is the pilot for?',
        a: 'The pilot is for aesthetic clinics and med-spas that receive leads or client messages through Instagram, WhatsApp, website chat, SMS, or email.',
      },
      {
        q: 'How is pricing handled?',
        a: 'Pilot pricing is confirmed during onboarding based on clinic size, channels, and workflow complexity.',
      },
    ],
  },
  {
    title: 'AI Front Desk',
    items: [
      {
        q: 'Does it send messages automatically?',
        a: 'During pilot, replies are drafted for staff approval by default. Automation can be enabled later once the clinic is comfortable with tone, consent, and workflow.',
      },
      {
        q: 'Which channels does it support?',
        a: 'The target pilot setup is Instagram, WhatsApp, website chat, SMS, and email, depending on what the clinic connects.',
      },
      {
        q: 'What does recovered revenue mean?',
        a: 'Recovered revenue is an estimate based on captured leads, approved AI drafts, filled cancellation slots, consult follow-ups, and bookings attributed within a conservative time window.',
      },
    ],
  },
  {
    title: 'Trust',
    items: [
      {
        q: 'Is this medical software?',
        a: 'No. The pilot does not market EMR, clinical documentation, diagnosis, treatment recommendations, medical record storage, or regulated clinical decision support.',
      },
      {
        q: 'Is my data protected?',
        a: 'Business Command Centre uses tenant isolation, role-based access, HTTPS, protected staff sessions, webhook signature checks, and approval-first AI workflows.',
      },
      {
        q: 'Can staff control what AI says?',
        a: 'Yes. The pilot starts with staff-reviewed drafts and clinic voice settings so your team can control tone and escalation boundaries.',
      },
    ],
  },
];

const allFaqItems = FAQ_CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => ({
    '@type': 'Question' as const,
    name: item.q,
    acceptedAnswer: { '@type': 'Answer' as const, text: item.a },
  })),
);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: allFaqItems,
};

export default function FaqPage() {
  return (
    <section className="px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">FAQ</p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900 sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Questions about the AI Front Desk pilot. For anything specific, apply with your clinic
            details and we&apos;ll reply with next steps.
          </p>
        </div>

        <div className="mt-14 space-y-10">
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {category.title}
              </h2>
              <div className="rounded-2xl bg-white p-6 shadow-soft sm:p-8">
                {category.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/pilot"
            className="btn-press inline-flex rounded-xl bg-sage-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sage-700"
          >
            Apply for Pilot
          </Link>
        </div>
      </div>
    </section>
  );
}
