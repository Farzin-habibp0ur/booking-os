import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
} from 'class-validator';

export class CreateMedicalRecordDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contraindications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditions?: string[];

  @IsOptional()
  @IsString()
  skinType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['I', 'II', 'III', 'IV', 'V', 'VI'])
  fitzpatrickScale?: string;

  @IsOptional()
  @IsBoolean()
  bloodThinners?: boolean;

  @IsOptional()
  @IsBoolean()
  pregnant?: boolean;

  @IsOptional()
  @IsBoolean()
  breastfeeding?: boolean;

  @IsOptional()
  @IsString()
  recentSurgery?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  flagReason?: string;

  @IsOptional()
  @IsBoolean()
  consentGiven?: boolean;
}
