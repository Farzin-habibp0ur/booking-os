import type { Metadata } from 'next';
import PilotApplicationForm from './pilot-application-form';

export const metadata: Metadata = {
  title: 'Apply for Pilot — Business Command Centre',
  description: 'Apply for the Business Command Centre AI Front Desk pilot for aesthetic clinics.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/pilot',
  },
};

export default function PilotPage() {
  return (
    <section className="px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">
            Pilot application
          </p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
            Bring the AI Front Desk into your clinic.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-500">
            Tell us where your front desk is losing time or revenue. We&apos;ll review fit, channel
            setup, and the first workflow to prove.
          </p>
          <div className="mt-8 space-y-4 text-sm text-slate-600">
            {[
              'Approval-first AI replies during pilot.',
              'Instagram, WhatsApp, website chat, SMS, and email scoped during onboarding.',
              'No EMR, diagnosis, treatment recommendation, or clinical decision-support claims.',
              'Recovered revenue is reported conservatively.',
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sage-600" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <PilotApplicationForm />
      </div>
    </section>
  );
}
