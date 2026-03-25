import { IsOptional, IsNumber, Min, Max, IsString, MaxLength, IsIn } from 'class-validator';

export class UpdateReferralSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(500)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  messageTemplate?: string;

  @IsOptional()
  @IsIn(['manual', 'whatsapp', 'sms', 'email'])
  sharingMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailSubject?: string;
}
