import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy — Business Command Centre',
  description: 'Privacy overview for Business Command Centre.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main className="px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-sage-700">Privacy</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated May 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            Business Command Centre helps aesthetic clinics manage front desk communication and
            appointment workflows. We collect the information needed to provide, secure, support,
            and improve the service.
          </p>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Information we process</h2>
            <p className="mt-2">
              This may include account details, staff profile information, clinic configuration,
              customer contact details, messages, booking details, usage events, support requests,
              and pilot application details submitted through this website.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">How we use information</h2>
            <p className="mt-2">
              We use information to operate the product, draft staff-reviewed replies, support
              clinic workflows, protect accounts, troubleshoot issues, communicate with applicants
              and customers, and measure product performance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Service providers</h2>
            <p className="mt-2">
              We may use infrastructure, messaging, analytics, email, payments, monitoring, and AI
              providers to deliver the service. Providers are used only for operational purposes
              related to Business Command Centre.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Clinic responsibility</h2>
            <p className="mt-2">
              Clinics are responsible for deciding what customer information they enter, connect, or
              send through the platform, and for ensuring their own consent, notice, retention, and
              regulatory obligations are met.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Contact</h2>
            <p className="mt-2">
              For privacy questions, contact{' '}
              <a
                className="text-sage-700 underline underline-offset-2"
                href="mailto:privacy@businesscommandcentre.com"
              >
                privacy@businesscommandcentre.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
