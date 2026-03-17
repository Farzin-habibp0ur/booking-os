'use client';

import Link from 'next/link';
import { FileText, Bot, Mail, BarChart3 } from 'lucide-react';

const sections = [
  {
    href: '/marketing/queue',
    label: 'Content Queue',
    description: 'Review and approve AI-generated content',
    icon: FileText,
  },
  {
    href: '/marketing/agents',
    label: 'Marketing Agents',
    description: 'Manage 12 marketing automation agents',
    icon: Bot,
  },
  {
    href: '/marketing/sequences',
    label: 'Email Sequences',
    description: 'Monitor email drip campaigns',
    icon: Mail,
  },
  {
    href: '/marketing/rejection-analytics',
    label: 'Rejection Analytics',
    description: 'Track content rejection patterns',
    icon: BarChart3,
  },
];

export default function MarketingPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">Marketing</h1>
      <p className="text-sm text-slate-600 mb-6">
        Internal content marketing and growth engine tools.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon size={20} className="text-lavender-500" />
              <h2 className="font-serif font-semibold text-slate-900">{label}</h2>
            </div>
            <p className="text-sm text-slate-600">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
