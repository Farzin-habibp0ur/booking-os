import type { Metadata } from 'next';
import LandingPage from './landing-page';

export const metadata: Metadata = {
  title: 'Booking OS — The All-in-One Command Center for Your Clinic',
  description:
    'Manage appointments, client messaging, and AI automation in one beautiful dashboard. Built for aesthetic clinics and service businesses.',
  alternates: {
    canonical: 'https://businesscommandcentre.com',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Booking OS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://businesscommandcentre.com',
  description:
    'All-in-one command center for aesthetic clinics and service businesses. Manage appointments, client messaging, and AI automation in one beautiful dashboard.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free trial available',
  },
  featureList: [
    'Appointment Scheduling',
    'Client Messaging via WhatsApp',
    'AI-Powered Automation',
    'Multi-Tenant Dashboard',
    'Real-Time Notifications',
    'Service Board Management',
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
