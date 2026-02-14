import {
  StaffRole,
  BookingStatus,
  ConversationStatus,
  ConversationChannel,
  MessageDirection,
  MessageContentType,
  ReminderStatus,
  TemplateCategory,
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
