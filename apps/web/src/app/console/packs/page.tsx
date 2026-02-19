'use client';

import { Package } from 'lucide-react';

export default function ConsolePacksPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        Packs & Skills
      </h1>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center">
        <Package className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Packs & Skills Management
        </h2>
        <p className="text-sm text-slate-500">
          Vertical pack configuration and skill management coming soon.
        </p>
      </div>
    </div>
  );
}
