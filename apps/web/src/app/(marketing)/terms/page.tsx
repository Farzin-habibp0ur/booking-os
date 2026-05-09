import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms — Business Command Centre',
  description: 'Terms of service overview for Business Command Centre.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/terms',
  },
};

export default function TermsPage() {
  return (
    <main className="px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">Terms</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated May 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            These terms describe the expected use of Business Command Centre during the pilot and
            early customer access period. A signed order form, pilot agreement, or data processing
            addendum may add more specific terms for a clinic.
          </p>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Use of the service</h2>
            <p className="mt-2">
              Business Command Centre is provided for clinic operations, customer communication,
              booking workflows, and staff-reviewed AI assistance. You agree not to misuse the
              service, attempt unauthorized access, or use it to send unlawful, deceptive, or
              non-consensual messages.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">AI assistance</h2>
            <p className="mt-2">
              AI-generated content is provided as staff-reviewed assistance. Clinics are responsible
              for reviewing messages before sending, configuring appropriate workflows, and ensuring
              customer communications are accurate and appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Not medical software</h2>
            <p className="mt-2">
              Business Command Centre is non-clinical infrastructure. It is not an EMR, diagnosis
              tool, treatment recommendation system, medical record system, or regulated clinical
              decision-support product. Your PMS remains the system of record for any patient health
              information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Pilot access</h2>
            <p className="mt-2">
              Pilot access may be limited, modified, or discontinued as the product is refined.
              Pricing, scope, support, and channel availability are confirmed during onboarding.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Contact</h2>
            <p className="mt-2">
              For terms questions, contact{' '}
              <a
                className="text-sage-700 underline underline-offset-2"
                href="mailto:legal@businesscommandcentre.com"
              >
                legal@businesscommandcentre.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
