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
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  @IsOptional()
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
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
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
  name!: string;

  @IsNumber()
  @Min(1)
  durationMins!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
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
  category?: string;

  @IsString()
  @IsOptional()
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
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
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
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  verticalPack?: string;

  @IsObject()
  @IsOptional()
  packConfig?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  defaultLocale?: string;

  @IsObject()
  @IsOptional()
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
  cancellationPolicyText?: string;

  @IsString()
  @IsOptional()
  reschedulePolicyText?: string;

  @IsBoolean()
  @IsOptional()
  policyEnabled?: boolean;
}

// ---- Template DTOs ----

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
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
  content!: string;
}

// ---- Working Hours DTO ----

export class WorkingHoursEntryDto {
  @IsNumber()
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

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
  email!: string;

  // M1 fix: Require 12+ chars with at least one uppercase, one lowercase, one digit
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
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

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
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

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
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
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
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
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
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
  name!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;

  @IsObject()
  @IsOptional()
  whatsappConfig?: Record<string, unknown>;
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;

  @IsObject()
  @IsOptional()
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
  name!: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class PreviewAudienceDto {
  @IsObject()
  filters!: Record<string, unknown>;
}

// ---- Automation Rule DTOs (H12) ----

export class CreateAutomationRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  trigger!: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  actions?: any[];

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
  name?: string;

  @IsString()
  @IsOptional()
  trigger?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  actions?: any[];

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
