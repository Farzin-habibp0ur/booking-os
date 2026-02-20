import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ArrayNotEmpty,
  ValidateNested,
  Matches,
  IsIn,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

// M4 fix: Custom validator to limit JSON custom field depth and size
function IsShallowJson(maxDepth = 3, maxKeys = 50, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isShallowJson',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must not exceed ${maxDepth} levels of nesting or ${maxKeys} keys`,
        ...validationOptions,
      },
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'object') return false;
          let totalKeys = 0;
          const checkDepth = (obj: any, depth: number): boolean => {
            if (depth > maxDepth) return false;
            if (typeof obj !== 'object' || obj === null) return true;
            const keys = Object.keys(obj);
            totalKeys += keys.length;
            if (totalKeys > maxKeys) return false;
            return keys.every((k) => checkDepth(obj[k], depth + 1));
          };
          return checkDepth(value, 1);
        },
      },
    });
  };
}

// ---- Booking DTOs ----

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsDateString()
  startTime!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  resourceId?: string;

  @IsBoolean()
  @IsOptional()
  forceBook?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  forceBookReason?: string;
}

export class UpdateBookingDto {
  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;
}

export class UpdateBookingStatusDto {
  @IsEnum(
    ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    {
      message:
        'status must be one of: PENDING, PENDING_DEPOSIT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW',
    },
  )
  status!: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}

export class UpdateKanbanStatusDto {
  @IsEnum(['CHECKED_IN', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'READY_FOR_PICKUP'], {
    message:
      'kanbanStatus must be one of: CHECKED_IN, DIAGNOSING, AWAITING_APPROVAL, IN_PROGRESS, READY_FOR_PICKUP',
  })
  kanbanStatus!: string;
}

// ---- Customer DTOs ----

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  email?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;
}

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  email?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;
}

// ---- Service DTOs ----

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(1)
  durationMins!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['CONSULT', 'TREATMENT', 'OTHER'])
  kind?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;
}

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  durationMins?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['CONSULT', 'TREATMENT', 'OTHER'])
  kind?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;
}

// ---- Staff DTOs ----

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsEnum(['ADMIN', 'SERVICE_PROVIDER', 'AGENT', 'SUPER_ADMIN'], {
    message: 'role must be one of: ADMIN, SERVICE_PROVIDER, AGENT, SUPER_ADMIN',
  })
  role!: string;
}

export class UpdateStaffDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(['ADMIN', 'SERVICE_PROVIDER', 'AGENT', 'SUPER_ADMIN'], {
    message: 'role must be one of: ADMIN, SERVICE_PROVIDER, AGENT, SUPER_ADMIN',
  })
  @IsOptional()
  role?: string;
}

// ---- Business DTOs ----

export class UpdateBusinessDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  verticalPack?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  packConfig?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultLocale?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  aiSettings?: Record<string, unknown>;
}

// ---- Policy Settings DTO ----

export class UpdatePolicySettingsDto {
  @IsNumber()
  @Min(1)
  @Max(168)
  @IsOptional()
  cancellationWindowHours?: number;

  @IsNumber()
  @Min(1)
  @Max(168)
  @IsOptional()
  rescheduleWindowHours?: number;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  cancellationPolicyText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  reschedulePolicyText?: string;

  @IsBoolean()
  @IsOptional()
  policyEnabled?: boolean;
}

// ---- Template DTOs ----

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  body?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];
}

// ---- Conversation DTOs ----

export class CreateBookingFromConversationDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsDateString()
  startTime!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  customFields?: Record<string, unknown>;
}

export class UpdateConversationStatusDto {
  @IsEnum(['OPEN', 'WAITING', 'SNOOZED', 'RESOLVED'], {
    message: 'status must be one of: OPEN, WAITING, SNOOZED, RESOLVED',
  })
  status!: string;
}

export class AssignConversationDto {
  @IsString()
  @IsOptional()
  staffId!: string | null;
}

export class SnoozeConversationDto {
  @IsDateString()
  until!: string;
}

export class UpdateTagsDto {
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}

export class AddNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}

// ---- Working Hours DTO ----

export class WorkingHoursEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsBoolean()
  isOff!: boolean;
}

export class SetWorkingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursEntryDto)
  hours!: WorkingHoursEntryDto[];
}

export class AddTimeOffDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

// ---- Webhook DTOs ----

export class WebhookInboundDto {
  @IsString()
  @IsNotEmpty()
  from!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  businessPhone?: string;
}

// ---- Auth DTOs ----

// L3 fix: LoginDto ensures empty body returns 400 not 500
export class LoginDto {
  @IsEmail()
  email!: string;

  // H1 fix: MaxLength prevents bcrypt DoS with huge strings
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  ownerName!: string;

  @IsEmail()
  email!: string;

  // M1 fix: Require 12+ chars with at least one uppercase, one lowercase, one digit
  // H1 fix: MaxLength prevents bcrypt DoS with huge strings
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  // H1 fix: MaxLength prevents bcrypt DoS
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  // H1 fix: MaxLength prevents bcrypt DoS
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  // H1 fix: MaxLength prevents bcrypt DoS
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  newPassword!: string;
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  // H1 fix: MaxLength prevents bcrypt DoS
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password!: string;
}

// ---- Offer DTOs (H9) ----

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  terms?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceIds?: string[];

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxRedemptions?: number;
}

export class UpdateOfferDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  terms?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceIds?: string[];

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxRedemptions?: number;
}

// ---- Location DTOs (Phase 3) ----

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  whatsappConfig?: Record<string, unknown>;
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;

  @IsObject()
  @IsOptional()
  @IsShallowJson()
  whatsappConfig?: Record<string, unknown>;
}

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateResourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class AssignStaffToLocationDto {
  @IsString()
  @IsNotEmpty()
  staffId!: string;
}

// ---- Email Verification DTO (M16) ----

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

// ---- Staff Preferences DTOs ----

export class UpdatePreferencesDto {
  @IsString()
  @IsOptional()
  mode?: string;

  @IsString()
  @IsOptional()
  landingPath?: string;
}

// ---- Staff Invitation DTOs ----

export class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['ADMIN', 'SERVICE_PROVIDER', 'AGENT', 'SUPER_ADMIN'], {
    message: 'role must be one of: ADMIN, SERVICE_PROVIDER, AGENT, SUPER_ADMIN',
  })
  @IsOptional()
  role?: string;
}

// ---- Recurring Series DTOs ----

export class CreateRecurringSeriesDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsDateString()
  startDate!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'timeOfDay must be in HH:mm format' })
  timeOfDay!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsInt()
  @Min(1)
  @Max(4)
  intervalWeeks!: number;

  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  totalCount?: number;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// ---- Dashboard DTOs ----

export class DismissNudgeDto {
  @IsString()
  @IsNotEmpty()
  nudgeId!: string;
}

export class CancelRecurringSeriesDto {
  @IsEnum(['single', 'future', 'all'], {
    message: 'scope must be one of: single, future, all',
  })
  scope!: 'single' | 'future' | 'all';

  @IsString()
  @IsOptional()
  bookingId?: string;
}

// ---- Campaign DTOs (H12) ----

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson(2, 30)
  filters?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson(2, 30)
  filters?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class PreviewAudienceDto {
  @IsObject()
  @IsShallowJson(2, 30)
  filters!: Record<string, unknown>;
}

// ---- Automation Rule DTOs (H12) ----

// H6 fix: Typed action DTO for automation rules (replaces any[])
export class AutomationActionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['SEND_TEMPLATE', 'UPDATE_STATUS', 'ASSIGN_STAFF', 'ADD_TAG', 'SEND_NOTIFICATION'])
  type!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  templateId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  value?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson(2, 20)
  params?: Record<string, unknown>;
}

export class CreateAutomationRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  // H4 fix: Validate trigger against known values
  @IsString()
  @IsNotEmpty()
  @IsIn(['BOOKING_CREATED', 'BOOKING_UPCOMING', 'STATUS_CHANGED', 'BOOKING_CANCELLED'], {
    message: 'trigger must be one of: BOOKING_CREATED, BOOKING_UPCOMING, STATUS_CHANGED, BOOKING_CANCELLED',
  })
  trigger!: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson(2, 30)
  filters?: Record<string, unknown>;

  // H6 fix: Typed actions array replaces any[]
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions?: AutomationActionDto[];

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'quietStart must be in HH:mm format' })
  quietStart?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'quietEnd must be in HH:mm format' })
  quietEnd?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  maxPerCustomerPerDay?: number;
}

export class UpdateAutomationRuleDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  // H4 fix: Validate trigger against known values
  @IsString()
  @IsOptional()
  @IsIn(['BOOKING_CREATED', 'BOOKING_UPCOMING', 'STATUS_CHANGED', 'BOOKING_CANCELLED'], {
    message: 'trigger must be one of: BOOKING_CREATED, BOOKING_UPCOMING, STATUS_CHANGED, BOOKING_CANCELLED',
  })
  trigger?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson(2, 30)
  filters?: Record<string, unknown>;

  // H6 fix: Typed actions array replaces any[]
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions?: AutomationActionDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'quietStart must be in HH:mm format' })
  quietStart?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'quietEnd must be in HH:mm format' })
  quietEnd?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  maxPerCustomerPerDay?: number;
}

// ---- Quote DTOs (Phase 3) ----

export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty()
  bookingId!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsString()
  @IsOptional()
  pdfUrl?: string;
}

// ---- Saved View DTOs ----

export class CreateSavedViewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  page!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsObject()
  @IsShallowJson(2, 30)
  filters!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateSavedViewDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsObject()
  @IsOptional()
  @IsShallowJson(2, 30)
  filters?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  isDashboard?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class ShareSavedViewDto {
  @IsBoolean()
  isShared!: boolean;
}

// ---- Pack Builder DTOs (Phase 3) ----

export class CreatePackDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

// ---- Customer Note DTOs ----

export class CreateCustomerNoteDto {
  // H5 fix: MaxLength prevents unlimited-size notes
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}

export class UpdateCustomerNoteDto {
  // H5 fix: MaxLength prevents unlimited-size notes
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}

export class UpdatePackDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

// ---- Platform Console DTOs ----

export class ConsoleBusinessQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['basic', 'pro', 'trial'])
  plan?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'past_due', 'canceled', 'trialing'])
  billingStatus?: string;

  @IsString()
  @IsOptional()
  vertical?: string;

  @IsString()
  @IsOptional()
  @IsIn(['green', 'yellow', 'red'])
  health?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class ViewAsReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

// --- Console Phase 2 DTOs ---

export class ConsoleAuditQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  actorId?: string;

  @IsString()
  @IsOptional()
  targetId?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class ConsoleSupportCaseQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @IsString()
  @IsOptional()
  businessId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class CreateSupportCaseDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;
}

export class UpdateSupportCaseDto {
  @IsString()
  @IsOptional()
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  resolution?: string;
}

export class AddSupportCaseNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}

// ---- Console Phase 3: Billing DTOs ----

export class ConsoleBillingSubscriptionsQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['basic', 'pro'])
  plan?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'past_due', 'canceled', 'trialing'])
  status?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class ConsolePlanChangeDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['basic', 'pro'])
  newPlan!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ConsoleCreditDto {
  @IsNumber()
  @Min(1)
  @Max(10000)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class ConsoleCancelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsBoolean()
  @IsOptional()
  immediate?: boolean;
}

// ---- Console Phase 4: Packs & Skills DTOs ----

export class ConsoleRolloutDto {
  @IsInt()
  @IsIn([5, 25, 50, 100])
  targetPercent!: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class ConsoleRollbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ConsolePinDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsInt()
  @Min(1)
  pinnedVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ConsoleSkillOverrideDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

// ---- Console Phase 5: Agent Governance DTOs ----

export class ConsolePauseAgentsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ConsoleUpdateTenantAgentDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['AUTO', 'SUGGEST', 'REQUIRE_APPROVAL'])
  autonomyLevel?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ConsolePlatformDefaultDto {
  @IsString()
  @IsIn(['AUTO', 'SUGGEST', 'REQUIRE_APPROVAL'])
  maxAutonomyLevel!: string;

  @IsBoolean()
  defaultEnabled!: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold!: number;

  @IsBoolean()
  requiresReview!: boolean;
}

// ---- Console Phase 6: Platform Settings DTOs ----

export class ConsoleSettingUpdateDto {
  @IsNotEmpty()
  value!: unknown;
}

export class ConsoleSettingBulkItem {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsNotEmpty()
  value!: unknown;
}

export class ConsoleSettingsBulkUpdateDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ConsoleSettingBulkItem)
  settings!: ConsoleSettingBulkItem[];
}
