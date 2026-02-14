import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WhatsApp Simulator - Booking OS',
  description: 'Mock WhatsApp UI for development',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 flex items-center justify-center min-h-screen">
        {children}
      </body>
    </html>
  );
}
