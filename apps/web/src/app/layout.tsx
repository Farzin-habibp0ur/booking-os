import type { Metadata } from 'next';
import { PostHogProvider } from '@/lib/posthog';
import './globals.css';

const SITE_URL = 'https://businesscommandcentre.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Booking OS — The All-in-One Command Center for Your Clinic',
    template: '%s | Booking OS',
  },
  description:
    'Manage appointments, client messaging, and AI automation in one beautiful dashboard. Built for aesthetic clinics and service businesses.',
  keywords: [
    'booking software',
    'clinic management',
    'appointment scheduling',
    'aesthetic clinic',
    'WhatsApp business',
    'AI automation',
    'client messaging',
    'service business',
    'salon booking',
    'practice management',
  ],
  authors: [{ name: 'Booking OS' }],
  creator: 'Booking OS',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Booking OS',
    title: 'Booking OS — The All-in-One Command Center for Your Clinic',
    description:
      'Manage appointments, client messaging, and AI automation in one beautiful dashboard. Built for aesthetic clinics and service businesses.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Booking OS — The All-in-One Command Center for Your Clinic',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Booking OS — The All-in-One Command Center for Your Clinic',
    description:
      'Manage appointments, client messaging, and AI automation in one beautiful dashboard. Built for aesthetic clinics and service businesses.',
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
    title: 'Booking OS',
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
