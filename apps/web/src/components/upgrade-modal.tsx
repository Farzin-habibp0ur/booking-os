'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, X, Sparkles, Check } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  requiredPlan?: 'professional' | 'enterprise';
}

const PLAN_FEATURES: Record<string, { label: string; plan: string; description: string }> = {
  whatsappInbox: {
    label: 'WhatsApp Inbox',
    plan: 'Professional',
    description: 'Send and receive WhatsApp messages directly from your inbox.',
  },
  aiAutoReplies: {
    label: 'AI Auto-Replies',
    plan: 'Professional',
    description: 'Let AI automatically respond to common customer inquiries.',
  },
  campaigns: {
    label: 'Campaigns',
    plan: 'Professional',
    description: 'Create and send marketing campaigns to your customer segments.',
  },
  advancedReports: {
    label: 'Advanced Reports',
    plan: 'Professional',
    description: 'Access detailed analytics, revenue tracking, and custom reports.',
  },
  multiLocation: {
    label: 'Multi-Location',
    plan: 'Enterprise',
    description: 'Manage multiple business locations from a single dashboard.',
  },
  apiAccess: {
    label: 'API Access',
    plan: 'Enterprise',
    description: 'Integrate with your existing tools via our REST API.',
  },
  whiteLabelBooking: {
    label: 'White-Label Booking',
    plan: 'Enterprise',
    description: 'Custom-branded booking pages with your domain and styling.',
  },
};

export function UpgradeModal({ isOpen, onClose, feature, requiredPlan }: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const featureInfo = PLAN_FEATURES[feature] || {
    label: feature,
    plan: requiredPlan === 'enterprise' ? 'Enterprise' : 'Professional',
    description: 'This feature requires a higher plan.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center justify-center w-12 h-12 bg-lavender-50 rounded-xl mb-4">
          <Lock size={24} className="text-lavender-600" />
        </div>

        <h2 className="text-xl font-serif font-semibold text-slate-900 dark:text-slate-100">
          Upgrade to {featureInfo.plan}
        </h2>
        <p className="text-sm text-slate-500 mt-1">{featureInfo.description}</p>

        <div className="mt-5 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-lavender-600" />
            <span className="text-sm font-medium text-lavender-800 dark:text-lavender-300">
              {featureInfo.plan} plan includes:
            </span>
          </div>
          <ul className="space-y-2">
            {(requiredPlan === 'enterprise'
              ? ['Multi-location support', 'API access', 'White-label booking', 'Dedicated account manager']
              : ['WhatsApp inbox', 'AI auto-replies', 'Campaigns', 'Advanced reports', 'Up to 5 staff']
            ).map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Check size={14} className="text-lavender-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              onClose();
              router.push('/settings/billing');
            }}
            className="flex-1 bg-lavender-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-lavender-700 transition-colors"
          >
            View Plans
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
