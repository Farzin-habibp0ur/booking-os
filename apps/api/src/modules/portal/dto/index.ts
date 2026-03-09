import {
  IsString,
  IsNotEmpty,
  Length,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsISO8601,
} from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;
}

export class RequestMagicLinkDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;
}

export class UpdatePortalProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  notifyWhatsApp?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RescheduleBookingDto {
  @IsISO8601()
  @IsNotEmpty()
  newStartTime!: string;
}
