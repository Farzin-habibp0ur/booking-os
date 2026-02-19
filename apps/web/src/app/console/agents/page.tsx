'use client';

import { Bot } from 'lucide-react';

export default function ConsoleAgentsPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        AI & Agents
      </h1>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center">
        <Bot className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
          AI & Agent Operations
        </h2>
        <p className="text-sm text-slate-500">
          Agent monitoring and AI usage analytics coming soon.
        </p>
      </div>
    </div>
  );
}
