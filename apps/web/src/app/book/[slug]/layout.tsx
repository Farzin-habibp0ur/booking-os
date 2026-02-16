'use client';

import { ToastProvider } from '@/lib/toast';

export default function BookingPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ backgroundColor: '#FCFCFD' }}>
        <div className="max-w-2xl mx-auto px-4 py-8">{children}</div>
      </div>
    </ToastProvider>
  );
}
