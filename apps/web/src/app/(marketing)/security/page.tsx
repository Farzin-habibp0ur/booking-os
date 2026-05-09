import type { Metadata } from 'next';
import { LockKeyhole, ShieldCheck, UserCheck, Webhook } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Security — Business Command Centre',
  description:
    'Security overview for Business Command Centre, the AI front desk for aesthetic clinics.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/security',
  },
};

const SAFEGUARDS = [
  {
    icon: ShieldCheck,
    title: 'Tenant isolation',
    body: 'Customer, booking, conversation, and reporting data is scoped to the authenticated clinic tenant.',
  },
  {
    icon: UserCheck,
    title: 'Role-based access',
    body: 'Staff roles restrict sensitive workflows, while Super Admin tools are kept in a separate console.',
  },
  {
    icon: Webhook,
    title: 'Webhook verification',
    body: 'Messaging and payment webhook handlers are designed to verify provider signatures before processing events.',
  },
  {
    icon: LockKeyhole,
    title: 'Approval-first AI',
    body: 'The pilot starts with staff-reviewed drafts, reducing the risk of incorrect or unwanted automated messages.',
  },
];

export default function SecurityPage() {
  return (
    <main className="px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
      <section className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">Security</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900 sm:text-5xl">
          Built for practical clinic trust.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-500">
          Business Command Centre uses conservative defaults for the AI Front Desk pilot: tenant
          isolation, staff approval, protected sessions, and verified integrations.
        </p>
      </section>

      <section className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SAFEGUARDS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl bg-white p-6 shadow-soft">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-50 text-sage-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.body}</p>
            </div>
          );
        })}
      </section>

      <section className="mx-auto mt-12 max-w-3xl rounded-2xl bg-white p-6 shadow-soft sm:p-8">
        <h2 className="font-serif text-2xl font-bold text-slate-900">Pilot boundaries</h2>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            Business Command Centre is not marketed as an EMR, diagnosis system, treatment
            recommendation tool, or regulated clinical decision-support product.
          </p>
          <p>
            Security and compliance needs vary by clinic, region, connected channel, and customer
            workflow. Clinics should review their own legal, privacy, consent, and retention
            obligations before sending customer data through any connected system.
          </p>
        </div>
      </section>
    </main>
  );
}
