'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How to create a booking',
    answer:
      'Navigate to the Bookings page from the sidebar and click the "New Booking" button. Select a customer (or create a new one), choose a service, pick a date and time slot, then confirm the booking. You can also create bookings directly from the Calendar view by clicking on an empty time slot.',
  },
  {
    question: 'How to set up services',
    answer:
      'Go to the Services page from the sidebar. Click "Add Service" to create a new service. Fill in the service name, duration, price, and description. You can assign specific staff members who can perform the service and set buffer times between appointments. Services can be organized by category for easier management.',
  },
  {
    question: 'How to manage staff schedules',
    answer:
      'Visit the Staff page and select a team member. From their profile, you can set their working hours for each day of the week, add breaks, and block off time for holidays or personal time. Staff availability automatically reflects in the booking calendar, so customers can only book during available slots.',
  },
  {
    question: 'How to configure the booking portal',
    answer:
      'Go to Settings and find the Portal section. Here you can customize your public booking page with your brand colors, logo, and welcome message. Configure which services are visible to customers, set cancellation and reschedule policies, and enable or disable deposit requirements. Your portal is accessible at your unique booking link.',
  },
  {
    question: 'How to set up payment processing',
    answer:
      'Navigate to Settings and select the Payments section. Connect your Stripe account to start accepting payments. You can configure deposit requirements for bookings, set up automatic payment collection, and manage refund policies. Payment history and revenue reports are available in the Reports section.',
  },
  {
    question: 'Keyboard shortcuts',
    answer:
      'Booking OS supports several keyboard shortcuts to speed up your workflow: Press Cmd+K (or Ctrl+K) to open the search palette. Press ? to open the help panel. Press Cmd+/ (or Ctrl+/) to view all keyboard shortcuts. Use arrow keys to navigate search results and Enter to select. Press Escape to close any open modal or panel.',
  },
];

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        aria-expanded={expanded}
        data-testid={`faq-toggle-${item.question.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {item.question}
        </span>
        {expanded ? (
          <ChevronDown size={16} className="text-slate-400 flex-shrink-0 ml-2" />
        ) : (
          <ChevronRight size={16} className="text-slate-400 flex-shrink-0 ml-2" />
        )}
      </button>
      {expanded && (
        <div className="px-5 pb-4" data-testid="faq-answer">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-sage-50 dark:bg-sage-900/30 flex items-center justify-center">
          <HelpCircle size={20} className="text-sage-600" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
            Help Center
          </h1>
          <p className="text-sm text-slate-500">Find answers to common questions</p>
        </div>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <FaqAccordionItem key={item.question} item={item} />
        ))}
      </div>
    </div>
  );
}
