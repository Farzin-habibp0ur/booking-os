import type { Metadata } from 'next';
import FaqItem from '@/components/faq-item';

export const metadata: Metadata = {
  title: 'FAQ — Booking OS',
  description:
    'Frequently asked questions about Booking OS — pricing, features, security, integrations, and getting started.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/faq',
  },
};

const FAQ_CATEGORIES = [
  {
    title: 'General',
    items: [
      {
        q: 'What is Booking OS?',
        a: 'Booking OS is an all-in-one command centre for service businesses. It combines appointment scheduling, client management, WhatsApp messaging, AI automation, billing, and analytics in a single platform.',
      },
      {
        q: 'Who is Booking OS for?',
        a: 'Booking OS is designed for aesthetic clinics, med-spas, salons, car dealerships, and other service-based businesses that manage appointments, clients, and communications.',
      },
      {
        q: 'How long is the free trial?',
        a: 'Every account starts with a full 14-day free trial with access to all features. No credit card is required to sign up.',
      },
      {
        q: 'Can I import data from my current system?',
        a: 'Yes. Booking OS supports CSV imports for clients, appointments, and services. Our onboarding team can also help with data migration from your existing platform.',
      },
    ],
  },
  {
    title: 'Pricing',
    items: [
      {
        q: 'How much does Booking OS cost?',
        a: 'Booking OS offers three plans: Starter ($49/mo), Professional ($99/mo), and Enterprise ($199/mo). All plans are 20% cheaper with annual billing. Visit our pricing page for full details.',
      },
      {
        q: 'Can I change plans later?',
        a: 'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. Upgrades are prorated, and downgrades take effect at the start of your next billing period.',
      },
      {
        q: 'Do you offer refunds?',
        a: 'Yes. If you are not satisfied within the first 30 days of a paid subscription, we will issue a full refund — no questions asked.',
      },
      {
        q: 'Are there any setup fees or contracts?',
        a: 'No. There are no setup fees, hidden charges, or long-term contracts. You pay only the subscription price and can cancel at any time.',
      },
    ],
  },
  {
    title: 'Features',
    items: [
      {
        q: 'Does Booking OS integrate with WhatsApp?',
        a: 'Yes. Booking OS connects to the official WhatsApp Business Cloud API. All client messages appear in a unified inbox with automated replies, booking confirmations, and conversation assignment.',
      },
      {
        q: 'What AI features are included?',
        a: 'The Professional and Enterprise plans include five background AI agents that handle appointment follow-ups, waitlist matching, retention outreach, data hygiene, and schedule optimisation. You also get AI-powered auto-replies and intent detection in your inbox.',
      },
      {
        q: 'Can I customise Booking OS for my industry?',
        a: 'Yes. Booking OS uses a Vertical Pack system tailored to your industry. Aesthetic clinics, salons, dealerships, and others each get purpose-built workflows, profile fields, and automations.',
      },
      {
        q: 'Does it support multiple locations?',
        a: 'Yes. The Enterprise plan includes multi-location management, allowing you to manage separate schedules, staff, and settings for each location from a single dashboard.',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        q: 'Is my data secure?',
        a: 'Yes. All data is encrypted in transit (TLS) and at rest. We use PostgreSQL with automated backups, role-based access control, and strict tenant isolation across every database query.',
      },
      {
        q: 'Do you comply with data protection regulations?',
        a: 'Booking OS is built with privacy by design. We implement data minimisation, consent management, and provide data export and deletion capabilities to help you meet your regulatory obligations.',
      },
      {
        q: 'Can I control staff access levels?',
        a: 'Yes. Booking OS supports five staff roles — Owner, Admin, Agent, Service Provider, and Super Admin — each with granular permissions for different parts of the platform.',
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
    <section className="pt-28 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-sage-600">FAQ</p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900 sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Everything you need to know about Booking OS. Can&apos;t find what you&apos;re looking
            for? Contact us at{' '}
            <a
              href="mailto:hello@bookingos.com"
              className="font-medium text-sage-600 underline underline-offset-2 hover:text-sage-700"
            >
              hello@bookingos.com
            </a>
          </p>
        </div>

        <div className="mt-14 space-y-10">
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
                {category.title}
              </h2>
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft sm:p-8">
                {category.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
