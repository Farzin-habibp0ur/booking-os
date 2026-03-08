'use client';

import { ToastProvider } from '@/lib/toast';

export default function BookingLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ backgroundColor: '#FCFCFD' }}>
        <div className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-8 pb-safe">{children}</div>
      </div>
    </ToastProvider>
  );
}
