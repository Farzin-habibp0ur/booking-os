'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  MessageSquare,
  Sparkles,
  BarChart3,
  CreditCard,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Check,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  FAQ data                                                           */
/* ------------------------------------------------------------------ */
const FAQ_ITEMS = [
  {
    q: 'How long is the free trial?',
    a: 'You get a full 14-day free trial with access to every feature. No credit card required to start.',
  },
  {
    q: 'Can I import my existing data?',
    a: 'Yes. We support CSV imports for clients, appointments, and services. Our team can also help migrate data from your current system during onboarding.',
  },
  {
    q: 'Does it work with WhatsApp?',
    a: 'Absolutely. Booking OS connects to the official WhatsApp Business Cloud API. All client messages arrive in a unified inbox alongside automated replies and booking confirmations.',
  },
  {
    q: 'What AI features are included?',
    a: 'Five background AI agents handle appointment follow-ups, waitlist matching, retention outreach, data hygiene, and schedule optimisation. You also get AI-powered auto-replies in your inbox.',
  },
  {
    q: 'Can I customize it for my specialty?',
    a: 'Booking OS uses a Vertical Pack system tailored to your industry. Aesthetic clinics, salons, dealerships, and more each get purpose-built workflows, fields, and automations.',
  },
  {
    q: 'What happens after the trial?',
    a: 'Choose a plan that fits your practice. Your data and configuration carry over seamlessly — nothing is lost. You can also cancel at any time with no penalties.',
  },
  {
    q: 'Is my data secure?',
    a: 'All data is encrypted in transit and at rest. We use PostgreSQL with automated backups, role-based access control, and tenant isolation across every query.',
  },
];

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */
const FEATURES = [
  {
    icon: Calendar,
    title: 'Scheduling & Calendar',
    desc: '24/7 online booking with smart availability, buffer times, and conflict detection.',
    isAi: false,
  },
  {
    icon: Users,
    title: 'Client Management',
    desc: 'Complete patient records, visit history, and customisable profile fields.',
    isAi: false,
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp Inbox',
    desc: 'All client messages in one unified inbox with conversation assignment and status tracking.',
    isAi: false,
  },
  {
    icon: Sparkles,
    title: 'AI Automation',
    desc: '5 AI agents handle follow-ups, reminders, retention, and auto-replies around the clock.',
    isAi: true,
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    desc: 'Revenue tracking, no-show rates, staff utilisation, and AI-generated insights.',
    isAi: false,
  },
  {
    icon: CreditCard,
    title: 'Billing & Payments',
    desc: 'Deposits, invoices, and Stripe-powered payments — all tied to each booking.',
    isAi: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Pricing data                                                       */
/* ------------------------------------------------------------------ */
const PLANS = [
  {
    name: 'Starter',
    price: 49,
    tagline: 'For solo practitioners',
    popular: false,
    features: [
      '1 staff member',
      'Unlimited bookings',
      'Client management',
      'WhatsApp inbox',
      'Basic analytics',
    ],
  },
  {
    name: 'Professional',
    price: 99,
    tagline: 'For growing clinics',
    popular: true,
    features: [
      'Up to 10 staff',
      'Everything in Starter',
      'AI automation agents',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 199,
    tagline: 'For multi-location businesses',
    popular: false,
    features: [
      'Unlimited staff',
      'Everything in Professional',
      'Multi-location support',
      'Custom integrations',
      'Dedicated account manager',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Smooth scroll helper                                               */
/* ------------------------------------------------------------------ */
function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ------------------------------------------------------------------ */
/*  FAQ Accordion Item                                                 */
/* ------------------------------------------------------------------ */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-sage-700"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-slate-800 sm:text-lg">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${open ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="text-slate-500 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Landing Page                                                       */
/* ================================================================== */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* Sticky header background on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = useCallback((id: string) => {
    setMenuOpen(false);
    scrollTo(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-slate-800">
      {/* -------------------------------------------------------- */}
      {/*  HEADER                                                   */}
      {/* -------------------------------------------------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/80 shadow-soft-sm backdrop-blur-lg' : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          {/* Logo */}
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-slate-900">
            Booking OS
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            <button
              onClick={() => scrollTo('features')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-sage-700"
            >
              Features
            </button>
            <button
              onClick={() => scrollTo('pricing')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-sage-700"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollTo('faq')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-sage-700"
            >
              FAQ
            </button>
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="btn-press rounded-xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sage-700"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="animate-fade-in border-t border-slate-100 bg-white px-5 pb-6 pt-2 md:hidden">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleNavClick('features')}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Features
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Pricing
              </button>
              <button
                onClick={() => handleNavClick('faq')}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                FAQ
              </button>
              <hr className="my-2 border-slate-100" />
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="btn-press mt-1 rounded-xl bg-sage-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-sage-700"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* -------------------------------------------------------- */}
      {/*  HERO                                                     */}
      {/* -------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40 lg:pb-36 lg:pt-48">
        {/* Abstract gradient background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-sage-100/60 blur-3xl sm:-top-20 sm:right-20" />
          <div className="absolute -left-20 top-20 h-[500px] w-[500px] rounded-full bg-lavender-100/50 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-[400px] w-[400px] rounded-full bg-sage-50/80 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            The all-in-one command centre <br className="hidden sm:block" />
            for your clinic.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl">
            Appointments, client messaging, AI automation — in one beautiful dashboard.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-sage-600 px-7 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-sage-700 hover:shadow-lg"
            >
              Start Free for 14 Days
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => scrollTo('features')}
              className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              See Features
            </button>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  SOCIAL PROOF BAR                                         */}
      {/* -------------------------------------------------------- */}
      <section className="border-y border-slate-100 bg-white/60 py-8">
        <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Trusted by aesthetic clinics and med-spas
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              'Glow Clinic',
              'Radiance Med Spa',
              'PureSkin Studio',
              'Aura Aesthetics',
              'LuxDerm',
            ].map((name) => (
              <span key={name} className="select-none text-sm font-medium text-slate-300">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  FEATURES                                                 */}
      {/* -------------------------------------------------------- */}
      <section id="features" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-600">
              Features
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
              Everything your clinic needs
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">
              Six powerful modules working together so you can focus on what matters — your
              patients.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`group rounded-2xl p-7 shadow-soft transition-shadow duration-300 hover:shadow-soft-lg ${
                    f.isAi
                      ? 'border border-lavender-100 bg-lavender-50/60'
                      : 'border border-slate-100 bg-white'
                  }`}
                >
                  <div
                    className={`inline-flex items-center justify-center rounded-xl p-2.5 ${
                      f.isAi ? 'bg-lavender-100 text-lavender-600' : 'bg-sage-50 text-sage-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  HOW IT WORKS                                             */}
      {/* -------------------------------------------------------- */}
      <section className="bg-slate-50/60 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-600">
              How it works
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
              Up and running in minutes
            </h2>
          </div>

          <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                step: 1,
                title: 'Sign up',
                desc: 'Create your account in under a minute. No credit card needed.',
              },
              {
                step: 2,
                title: 'Set up your clinic',
                desc: 'Add services, staff, and availability. Import existing clients.',
              },
              {
                step: 3,
                title: 'Start accepting bookings',
                desc: 'Share your booking link and let AI handle the rest.',
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-600 font-serif text-lg font-bold text-white shadow-md">
                  {s.step}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  PRICING                                                  */}
      {/* -------------------------------------------------------- */}
      <section id="pricing" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-600">Pricing</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">
              Start free for 14 days. Upgrade, downgrade, or cancel at any time.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-8 shadow-soft transition-shadow duration-300 hover:shadow-soft-lg ${
                  plan.popular
                    ? 'border-2 border-sage-500 bg-white ring-1 ring-sage-500/10'
                    : 'border border-slate-100 bg-white'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sage-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                    Most Popular
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                </div>
                <div className="mt-6">
                  <span className="font-serif text-4xl font-bold text-slate-900">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-slate-400">/mo</span>
                </div>
                <ul className="mt-6 flex flex-col gap-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage-500" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <Link
                    href="/signup"
                    className={`btn-press block rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                      plan.popular
                        ? 'bg-sage-600 text-white hover:bg-sage-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Start Free Trial
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-400">
            Need a custom plan?{' '}
            <Link
              href="/login"
              className="font-medium text-sage-600 underline underline-offset-2 hover:text-sage-700"
            >
              Contact us
            </Link>
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  FAQ                                                      */}
      {/* -------------------------------------------------------- */}
      <section id="faq" className="scroll-mt-24 bg-slate-50/60 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-600">FAQ</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-12 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft sm:p-8">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  FINAL CTA                                                */}
      {/* -------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden py-20 sm:py-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-sage-100/50 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[300px] w-[400px] rounded-full bg-lavender-100/40 blur-3xl" />
        </div>
        <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
          <h2 className="font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
            Ready to transform your clinic?
          </h2>
          <p className="mt-4 text-slate-500">
            Join hundreds of clinics that run smarter with Booking OS. Start your free 14-day trial
            today.
          </p>
          <Link
            href="/signup"
            className="btn-press mt-8 inline-flex items-center gap-2 rounded-xl bg-sage-600 px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-sage-700 hover:shadow-lg"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------- */}
      {/*  FOOTER                                                   */}
      {/* -------------------------------------------------------- */}
      <footer className="border-t border-slate-100 bg-white py-12">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
            {/* Logo + tagline */}
            <div>
              <Link href="/" className="font-serif text-lg font-bold text-slate-900">
                Booking OS
              </Link>
              <p className="mt-1 text-sm text-slate-400">
                The operating system for service businesses.
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-12 text-sm">
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Product
                </span>
                <button
                  onClick={() => scrollTo('features')}
                  className="text-left text-slate-500 hover:text-slate-700"
                >
                  Features
                </button>
                <button
                  onClick={() => scrollTo('pricing')}
                  className="text-left text-slate-500 hover:text-slate-700"
                >
                  Pricing
                </button>
                <Link href="/login" className="text-slate-500 hover:text-slate-700">
                  Login
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Legal
                </span>
                <span className="cursor-default text-slate-400">Privacy Policy</span>
                <span className="cursor-default text-slate-400">Terms of Service</span>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Booking OS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
