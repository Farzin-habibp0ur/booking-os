import type { Metadata } from 'next';
import LandingPage from './landing-page';

export const metadata: Metadata = {
  title: 'Business Command Centre — AI Front Desk for Aesthetic Clinics',
  description:
    'Turn missed clinic messages into booked appointments with an AI front desk for aesthetic clinics.',
  alternates: {
    canonical: 'https://businesscommandcentre.com',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Business Command Centre',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://businesscommandcentre.com',
  description:
    'AI front desk for aesthetic clinics: captures Instagram, WhatsApp, and website leads, drafts replies, fills cancellations, follows up consults, and proves recovered revenue.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Pilot applications available',
  },
  featureList: [
    'Instagram, WhatsApp, and Web Lead Capture',
    'AI-Drafted Staff Replies',
    'Cancellation Fill Workflows',
    'Consult Follow-Up Tracking',
    'Recovered Revenue Attribution',
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
