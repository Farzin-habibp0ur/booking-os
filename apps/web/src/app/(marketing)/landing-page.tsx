'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  MessageSquareText,
  Send,
  Sparkles,
} from 'lucide-react';
import FaqItem from '@/components/faq-item';

const PROMISE =
  'Business Command Centre is an AI front desk for aesthetic clinics. It captures Instagram, WhatsApp, and website leads, drafts replies, fills cancellations, follows up consults, and proves recovered revenue.';

const WORKFLOW = [
  {
    icon: MessageSquareText,
    title: 'Capture every lead',
    desc: 'Instagram, WhatsApp, website chat, SMS, and email conversations land in one front desk workflow.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approve drafted replies',
    desc: 'The AI Front Desk drafts fast, clinic-safe responses for staff review before anything goes out.',
  },
  {
    icon: CalendarClock,
    title: 'Fill the calendar gaps',
    desc: 'Cancelled slots, waitlist opportunities, and stalled consults become visible follow-up work.',
  },
  {
    icon: BarChart3,
    title: 'Measure recovered revenue',
    desc: 'Track leads captured, drafts approved, appointments attributed, and revenue recovered.',
  },
];

const CHANNELS = ['Instagram', 'WhatsApp', 'Website chat', 'SMS', 'Email'];

const FAQ_ITEMS = [
  {
    q: 'What is Business Command Centre?',
    a: 'Business Command Centre is an AI front desk for aesthetic clinics. It helps your team respond faster to leads, follow up consults, fill cancellations, and track recovered revenue.',
  },
  {
    q: 'Does it send messages automatically?',
    a: 'During pilot, replies are drafted for staff approval by default. Automation can be enabled later once the clinic is comfortable with tone, consent, and workflow.',
  },
  {
    q: 'Which channels does it support?',
    a: 'The target pilot setup is Instagram, WhatsApp, website chat, SMS, and email, depending on what the clinic connects.',
  },
  {
    q: 'Is this medical software?',
    a: 'No. The pilot does not market EMR, clinical documentation, diagnosis, treatment recommendations, medical record storage, or regulated clinical decision support.',
  },
  {
    q: 'How is pricing handled?',
    a: 'Pilot pricing is confirmed during onboarding based on clinic size, channels, and workflow complexity.',
  },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function InboxPreview() {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-lavender-600">
            AI Front Desk
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Today&apos;s clinic queue</p>
        </div>
        <span className="rounded-full bg-sage-50 px-3 py-1 text-xs font-medium text-sage-900">
          Staff approval on
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_0.8fr]">
        <div className="divide-y divide-slate-100">
          {[
            {
              channel: 'Instagram',
              name: 'New consult lead',
              body: 'Asked about lip filler availability this week.',
              status: 'Draft ready',
            },
            {
              channel: 'WhatsApp',
              name: 'Cancellation gap',
              body: 'Tuesday 3:30 PM can be offered to two waitlist clients.',
              status: 'Opportunity',
            },
            {
              channel: 'Website chat',
              name: 'Consult follow-up',
              body: 'No booking yet after quote was sent 3 days ago.',
              status: 'Follow up',
            },
          ].map((item) => (
            <div key={item.name} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">{item.channel}</span>
                <span className="rounded-full bg-lavender-50 px-2.5 py-1 text-xs font-medium text-lavender-900">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-5 md:border-l md:border-t-0">
          <p className="text-sm font-semibold text-slate-900">Recovered revenue signal</p>
          <div className="mt-4 space-y-3">
            {[
              ['Leads captured', '18'],
              ['Drafts approved', '11'],
              ['Bookings attributed', '4'],
              ['Estimated recovered', '$1,240'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="font-serif text-lg font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600">
            Conservative attribution based on approved AI drafts, waitlist fills, and bookings
            inside a 14-day window.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="border-b border-slate-100 bg-[#FCFCFD] pt-28 sm:pt-32">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">
              Business Command Centre
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Turn missed clinic messages into booked appointments.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Capture Instagram, WhatsApp, and website leads, draft replies for approval, fill
              cancelled slots, follow up consults, and measure recovered revenue.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pilot"
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-sage-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-sage-700"
              >
                Apply for Pilot
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => scrollTo('how-it-works')}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300"
              >
                See How It Works
              </button>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-slate-500">{PROMISE}</p>
          </div>

          <InboxPreview />
        </div>
      </section>

      <section id="features" className="scroll-mt-24 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">
              Front desk workflow
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
              Built around the moments clinics lose revenue.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl bg-white p-6 shadow-soft">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender-50 text-lavender-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">
                Pilot setup
              </p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
                Approval-first automation for real clinic workflows.
              </h2>
              <p className="mt-4 text-slate-500">
                The pilot starts with drafts and clear attribution. Auto-send can wait until the
                clinic has reviewed tone, consent, and escalation rules.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full bg-sage-50 px-3 py-1.5 text-sm font-medium text-sage-900"
                  >
                    {channel}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {[
                'Connect the clinic inbox channels.',
                'Set the clinic voice and escalation boundaries.',
                'Review AI-drafted replies before sending.',
                'Fill cancellation gaps from the waitlist.',
                'Track attributed bookings and recovered revenue.',
              ].map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl bg-slate-50 p-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-600 font-serif text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium leading-8 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">Pilot</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
            Pricing is confirmed during onboarding.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-500">
            Pilot pricing depends on clinic size, channels connected, and workflow complexity. The
            goal is simple: prove the recovered-revenue case before asking you to scale usage.
          </p>
          <Link
            href="/pilot"
            className="btn-press mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-800"
          >
            Apply for Pilot
            <Send className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">FAQ</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 rounded-2xl bg-white p-6 shadow-soft sm:p-8">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <Sparkles className="mx-auto h-8 w-8 text-lavender-600" />
          <h2 className="mt-4 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
            Ready to test the AI Front Desk in your clinic?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-500">
            Apply with your clinic details and the front desk workflow you most want to fix first.
          </p>
          <Link
            href="/pilot"
            className="btn-press mt-8 inline-flex items-center gap-2 rounded-xl bg-sage-600 px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-sage-700"
          >
            Apply for Pilot
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
