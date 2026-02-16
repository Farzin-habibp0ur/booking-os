export enum StaffRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  WAITING = 'WAITING',
  RESOLVED = 'RESOLVED',
  SNOOZED = 'SNOOZED',
}

export enum ConversationChannel {
  WHATSAPP = 'WHATSAPP',
  WEB = 'WEB',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TemplateCategory {
  REMINDER = 'REMINDER',
  CONFIRMATION = 'CONFIRMATION',
  FOLLOW_UP = 'FOLLOW_UP',
  CONSULT_FOLLOW_UP = 'CONSULT_FOLLOW_UP',
  AFTERCARE = 'AFTERCARE',
  TREATMENT_CHECK_IN = 'TREATMENT_CHECK_IN',
  CUSTOM = 'CUSTOM',
}

export enum ServiceKind {
  CONSULT = 'CONSULT',
  TREATMENT = 'TREATMENT',
  OTHER = 'OTHER',
}

export enum VerticalPack {
  AESTHETIC = 'aesthetic',
  SALON = 'salon',
  TUTORING = 'tutoring',
  GENERAL = 'general',
}
