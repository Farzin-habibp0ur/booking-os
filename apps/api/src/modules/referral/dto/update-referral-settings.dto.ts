import { IsOptional, IsBoolean, IsNumber, IsString, Min, Max } from 'class-validator';

export class UpdateReferralSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(500)
  referrerCredit?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(500)
  refereeCredit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxReferralsPerCustomer?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  creditExpiryMonths?: number;

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsString()
  emailSubject?: string;
}
