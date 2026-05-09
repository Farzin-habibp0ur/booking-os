import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const CHANNELS = ['INSTAGRAM', 'WHATSAPP', 'WEB_CHAT', 'SMS', 'EMAIL', 'FACEBOOK', 'OTHER'];
const LEAD_VOLUME = ['UNDER_50', '50_150', '150_500', '500_PLUS', 'UNKNOWN'];

export class CreatePilotApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clinicName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  websiteOrInstagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  countryTimezone?: string;

  @IsOptional()
  @IsIn(LEAD_VOLUME)
  monthlyLeadVolume?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(CHANNELS, { each: true })
  currentChannels?: string[];

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  biggestFrontDeskPain!: string;

  @IsBoolean()
  consent!: boolean;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;
}
