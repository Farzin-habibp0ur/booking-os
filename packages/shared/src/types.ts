import {
  StaffRole,
  BookingStatus,
  ConversationStatus,
  ConversationChannel,
  MessageDirection,
  MessageContentType,
  ReminderStatus,
  TemplateCategory,
  ServiceKind,
  VerticalPack,
} from './enums';

// ---- Entity types ----

export interface Business {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  timezone: string;
  verticalPack: VerticalPack;
  packConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Staff {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  durationMins: number;
  price: number;
  category: string;
  kind: ServiceKind;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  businessId: string;
  customerId: string;
  serviceId: string;
  staffId: string | null;
  conversationId: string | null;
  status: BookingStatus;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  businessId: string;
  customerId: string;
  assignedToId: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  senderStaffId: string | null;
  content: string;
  contentType: MessageContentType;
  externalId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Reminder {
  id: string;
  businessId: string;
  bookingId: string;
  templateId: string | null;
  scheduledAt: Date;
  sentAt: Date | null;
  status: ReminderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTemplate {
  id: string;
  businessId: string;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- Vertical Pack types ----

export interface VerticalFieldDefinition {
  key: string;
  type: 'text' | 'boolean' | 'number' | 'select' | 'date';
  label: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface VerticalPackDefinition {
  name: string;
  labels: {
    customer: string;
    booking: string;
    service: string;
  };
  customerFields: VerticalFieldDefinition[];
  bookingFields: VerticalFieldDefinition[];
  serviceFields: VerticalFieldDefinition[];
  defaultTemplates: Array<{
    name: string;
    category: TemplateCategory;
    body: string;
    variables: string[];
  }>;
  defaultServices?: Array<{
    name: string;
    durationMins: number;
    price: number;
    category: string;
    kind: 'CONSULT' | 'TREATMENT' | 'OTHER';
    depositRequired?: boolean;
    depositAmount?: number;
  }>;
  defaultNotificationSettings?: {
    channels: string;
    followUpDelayHours: number;
    consultFollowUpDays: number;
    treatmentCheckInHours: number;
  };
  defaultRequiredProfileFields?: string[];
  defaultPackConfig?: Record<string, unknown>;
}

// ---- Messaging types ----

export interface OutboundMessage {
  to: string; // phone number E.164
  body: string;
  businessId: string;
  conversationId?: string;
}

export interface InboundMessage {
  from: string; // phone number E.164
  body: string;
  externalId: string;
  timestamp: Date;
  contentType?: MessageContentType;
}

// ---- API response types ----

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardData {
  todayBookings: Booking[];
  unassignedConversations: Conversation[];
  metrics: {
    totalBookingsThisWeek: number;
    totalBookingsLastWeek: number;
    noShowRate: number;
    avgResponseTimeMins: number;
  };
}

// ---- Phase 1 feature flags ----

export interface Phase1Config {
  outcomeTracking: boolean;
  beforeAfterPhotos: boolean;
  treatmentPlans: boolean;
  consentForms: boolean;
  productRecommendations: boolean;
}

export type Phase1Flag = keyof Phase1Config;

export const PHASE1_DEFAULTS: Phase1Config = {
  outcomeTracking: false,
  beforeAfterPhotos: false,
  treatmentPlans: false,
  consentForms: false,
  productRecommendations: false,
};

export function isPhase1Enabled(
  packConfig: Record<string, unknown> | null | undefined,
  flag: Phase1Flag,
): boolean {
  if (!packConfig) return false;
  const phase1 = packConfig.phase1 as Partial<Phase1Config> | undefined;
  if (!phase1) return false;
  return phase1[flag] === true;
}

export function getPhase1Config(
  packConfig: Record<string, unknown> | null | undefined,
): Phase1Config {
  if (!packConfig) return { ...PHASE1_DEFAULTS };
  const phase1 = packConfig.phase1 as Partial<Phase1Config> | undefined;
  if (!phase1) return { ...PHASE1_DEFAULTS };
  return { ...PHASE1_DEFAULTS, ...phase1 };
}
