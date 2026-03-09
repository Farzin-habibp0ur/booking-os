import { IsString, IsOptional, IsArray, IsBoolean, MaxLength, IsIn } from 'class-validator';

const SEQUENCE_TYPES = [
  'WELCOME',
  'FEATURE_EDUCATION',
  'SOCIAL_PROOF',
  'TRIAL_EXPIRY',
  'WIN_BACK',
  'UPGRADE',
  'REFERRAL',
  'CUSTOM',
];

export class CreateSequenceDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsIn(SEQUENCE_TYPES)
  type!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  steps!: any[];

  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @IsOptional()
  @IsString()
  stopOnEvent?: string;

  @IsOptional()
  metadata?: any;
}
