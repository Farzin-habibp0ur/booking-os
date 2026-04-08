import {
  CalendarPlus,
  Clock,
  ArrowRightLeft,
  CalendarX,
  UserPlus,
  CreditCard,
  Star,
  Send,
  Gift,
  MessageSquare,
  MessageCircle,
  Mail,
  Tag,
  UserCheck,
  Bell,
  Globe,
  FileText,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface TriggerInfo {
  label: string;
  icon: LucideIcon;
  category: string;
}

export interface ActionInfo {
  label: string;
  icon: LucideIcon;
}

export const TRIGGER_LABELS: Record<string, TriggerInfo> = {
  BOOKING_CREATED: {
    label: 'When a booking is created',
    icon: CalendarPlus,
    category: 'Booking Events',
  },
  BOOKING_UPCOMING: {
    label: 'Before an upcoming booking',
    icon: Clock,
    category: 'Booking Events',
  },
  STATUS_CHANGED: {
    label: 'When booking status changes',
    icon: ArrowRightLeft,
    category: 'Booking Events',
  },
  BOOKING_CANCELLED: {
    label: 'When a booking is cancelled',
    icon: CalendarX,
    category: 'Booking Events',
  },
  CUSTOMER_CREATED: {
    label: 'When a new customer is added',
    icon: UserPlus,
    category: 'Customer Events',
  },
  PAYMENT_RECEIVED: {
    label: 'When a payment is received',
    icon: CreditCard,
    category: 'Payment Events',
  },
  TESTIMONIAL_SUBMITTED: {
    label: 'When a testimonial is submitted',
    icon: Star,
    category: 'Customer Events',
  },
  CAMPAIGN_SENT: {
    label: 'When a campaign is sent',
    icon: Send,
    category: 'Communication',
  },
  REFERRAL_EARNED: {
    label: 'When a referral is earned',
    icon: Gift,
    category: 'Referral Events',
  },
  REFERRAL_REDEEMED: {
    label: 'When a referral is redeemed',
    icon: Gift,
    category: 'Referral Events',
  },
  MESSAGE_RECEIVED: {
    label: 'When a message is received',
    icon: MessageSquare,
    category: 'Communication',
  },
  NO_RESPONSE: {
    label: "When customer doesn't respond",
    icon: MessageCircle,
    category: 'Communication',
  },
};

export const ACTION_LABELS: Record<string, ActionInfo> = {
  SEND_MESSAGE: { label: 'Send a message', icon: MessageSquare },
  SEND_EMAIL: { label: 'Send an email', icon: Mail },
  SEND_TEMPLATE: { label: 'Send a message template', icon: FileText },
  REQUEST_TESTIMONIAL: { label: 'Request a testimonial', icon: Star },
  UPDATE_STATUS: { label: 'Update status', icon: ArrowRightLeft },
  ADD_TAG: { label: 'Add a tag', icon: Tag },
  UPDATE_CUSTOMER_FIELD: { label: 'Update customer field', icon: UserCheck },
  ASSIGN_STAFF: { label: 'Assign to staff member', icon: Users },
  SEND_NOTIFICATION: { label: 'Send staff notification', icon: Bell },
  WEBHOOK: { label: 'Call external webhook', icon: Globe },
};

export const TRIGGER_CATEGORIES = [
  {
    name: 'Booking Events',
    triggers: ['BOOKING_CREATED', 'BOOKING_UPCOMING', 'STATUS_CHANGED', 'BOOKING_CANCELLED'],
  },
  { name: 'Customer Events', triggers: ['CUSTOMER_CREATED', 'TESTIMONIAL_SUBMITTED'] },
  { name: 'Payment Events', triggers: ['PAYMENT_RECEIVED'] },
  { name: 'Communication', triggers: ['MESSAGE_RECEIVED', 'NO_RESPONSE', 'CAMPAIGN_SENT'] },
  { name: 'Referral Events', triggers: ['REFERRAL_EARNED', 'REFERRAL_REDEEMED'] },
];

export function getTriggerLabel(trigger: string): string {
  return TRIGGER_LABELS[trigger]?.label || trigger.replace(/_/g, ' ').toLowerCase();
}

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action]?.label || action.replace(/_/g, ' ').toLowerCase();
}
