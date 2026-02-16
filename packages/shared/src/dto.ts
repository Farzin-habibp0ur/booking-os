import {
  BookingStatus,
  ConversationStatus,
  StaffRole,
  TemplateCategory,
  VerticalPack,
} from './enums';

// ---- Auth DTOs ----

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
    businessId: string;
  };
}

// ---- Business DTOs ----

export interface UpdateBusinessDto {
  name?: string;
  phone?: string;
  timezone?: string;
  verticalPack?: VerticalPack;
  packConfig?: Record<string, unknown>;
}

// ---- Staff DTOs ----

export interface CreateStaffDto {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}

export interface UpdateStaffDto {
  name?: string;
  email?: string;
  role?: StaffRole;
}

// ---- Customer DTOs ----

export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

// ---- Service DTOs ----

export interface CreateServiceDto {
  name: string;
  durationMins: number;
  price: number;
  category: string;
  kind?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateServiceDto {
  name?: string;
  durationMins?: number;
  price?: number;
  category?: string;
  kind?: string;
  customFields?: Record<string, unknown>;
}

// ---- Booking DTOs ----

export interface CreateBookingDto {
  customerId: string;
  serviceId: string;
  staffId?: string;
  conversationId?: string;
  startTime: string; // ISO date
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateBookingDto {
  serviceId?: string;
  staffId?: string;
  startTime?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateBookingStatusDto {
  status: BookingStatus;
}

// ---- Conversation DTOs ----

export interface UpdateConversationStatusDto {
  status: ConversationStatus;
}

export interface AssignConversationDto {
  staffId: string | null;
}

// ---- Message DTOs ----

export interface SendMessageDto {
  content: string;
}

// ---- Webhook DTOs ----

export interface WebhookInboundDto {
  from: string;
  body: string;
  externalId: string;
  timestamp?: string;
}

// ---- Template DTOs ----

export interface CreateTemplateDto {
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
}

// ---- Query params ----

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface BookingListQuery extends PaginationQuery {
  status?: BookingStatus;
  staffId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ConversationListQuery extends PaginationQuery {
  status?: ConversationStatus;
  assignedToId?: string;
  unassigned?: boolean;
}

export interface CustomerListQuery extends PaginationQuery {
  search?: string;
}

export interface CalendarQuery {
  dateFrom: string;
  dateTo: string;
  staffId?: string;
}
