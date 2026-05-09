import type { Metadata } from 'next';
import { PostHogProvider } from '@/lib/posthog';
import './globals.css';

const SITE_URL = 'https://businesscommandcentre.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Business Command Centre — AI Front Desk for Aesthetic Clinics',
    template: '%s | Business Command Centre',
  },
  description:
    'Turn missed clinic messages into booked appointments with an AI front desk for aesthetic clinics.',
  keywords: [
    'AI front desk',
    'aesthetic clinic',
    'med spa',
    'Instagram leads',
    'WhatsApp business',
    'clinic messaging',
    'consult follow up',
    'waitlist automation',
    'recovered revenue',
  ],
  authors: [{ name: 'Business Command Centre' }],
  creator: 'Business Command Centre',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Business Command Centre',
    title: 'Business Command Centre — AI Front Desk for Aesthetic Clinics',
    description:
      'Turn missed clinic messages into booked appointments with an AI front desk for aesthetic clinics.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Business Command Centre — AI Front Desk for Aesthetic Clinics',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Business Command Centre — AI Front Desk for Aesthetic Clinics',
    description:
      'Turn missed clinic messages into booked appointments with an AI front desk for aesthetic clinics.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Business Command Centre',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#71907C" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans antialiased mobile-safe-top">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-sage-600 focus:text-white focus:rounded-xl focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
