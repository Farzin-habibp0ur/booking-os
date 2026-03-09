'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sage-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              B
            </div>
            <span className="text-sm text-slate-500">Customer Portal</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center">
        <p className="text-xs text-slate-400">
          Powered by{' '}
          <Link href="/" className="text-sage-600 hover:text-sage-700">
            Booking OS
          </Link>
        </p>
      </footer>
    </div>
  );
}
