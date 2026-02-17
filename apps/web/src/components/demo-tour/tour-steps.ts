export interface TourStep {
  id: string;
  target: string; // data-tour-target value
  title: string;
  description: string;
  page: string; // route path
  position: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    target: 'dashboard-metrics',
    title: 'Your business at a glance',
    description:
      'See key metrics like bookings, revenue, customer count, and response times — all updated in real time.',
    page: '/dashboard',
    position: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'bookings',
    target: 'bookings-table',
    title: 'Manage all appointments',
    description:
      'View, filter, and manage every booking. Bulk actions, status updates, and rescheduling — all in one place.',
    page: '/bookings',
    position: 'top',
  },
  {
    id: 'calendar',
    target: 'calendar-grid',
    title: 'Visual scheduling',
    description:
      'Drag-and-drop calendar view for your team. See availability at a glance and avoid double-bookings.',
    page: '/calendar',
    position: 'top',
  },
  {
    id: 'customers',
    target: 'customers-table',
    title: 'Customer profiles with insights',
    description:
      'Rich customer profiles with visit history, tags, and custom fields. Quickly find anyone with search and filters.',
    page: '/customers',
    position: 'top',
  },
  {
    id: 'inbox',
    target: 'inbox-panel',
    title: 'WhatsApp conversations',
    description:
      'Manage all customer conversations in one unified inbox. Assign to team members, snooze, and use AI-powered replies.',
    page: '/inbox',
    position: 'right',
  },
  {
    id: 'waitlist',
    target: 'waitlist-table',
    title: 'Smart waitlist management',
    description:
      'When slots open up, automatically offer them to waitlisted customers. Track offers, claims, and fill rates.',
    page: '/waitlist',
    position: 'top',
  },
  {
    id: 'campaigns',
    target: 'campaigns-list',
    title: 'Marketing campaigns',
    description:
      'Send targeted WhatsApp campaigns to customer segments. Track delivery, read rates, and bookings generated.',
    page: '/campaigns',
    position: 'top',
  },
  {
    id: 'automations',
    target: 'automations-list',
    title: 'Set it and forget it',
    description:
      'Automate reminders, follow-ups, and no-show handling. Runs 24/7 with quiet hours respected.',
    page: '/automations',
    position: 'top',
  },
  {
    id: 'settings',
    target: 'settings-nav',
    title: 'Customize everything',
    description:
      'Configure services, staff, working hours, notification preferences, and more to match your workflow.',
    page: '/settings',
    position: 'right',
  },
];
