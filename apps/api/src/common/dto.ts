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
} from 'class-validator';
import { Type } from 'class-transformer';

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
  customFields?: Record<string, unknown>;
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

  @IsEnum(['ADMIN', 'SERVICE_PROVIDER', 'AGENT'], {
    message: 'role must be one of: ADMIN, SERVICE_PROVIDER, AGENT',
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

  @IsEnum(['ADMIN', 'SERVICE_PROVIDER', 'AGENT'], {
    message: 'role must be one of: ADMIN, SERVICE_PROVIDER, AGENT',
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

  @IsString()
  @MinLength(8)
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
  @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

// ---- Staff Invitation DTOs ----

export class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['ADMIN', 'SERVICE_PROVIDER', 'AGENT'], {
    message: 'role must be one of: ADMIN, SERVICE_PROVIDER, AGENT',
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
