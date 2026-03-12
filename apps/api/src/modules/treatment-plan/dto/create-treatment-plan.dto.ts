import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SessionDto {
  @IsString()
  serviceId!: string;

  @IsNumber()
  @Min(1)
  sequenceOrder!: number;

  @IsString()
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class CreateTreatmentPlanDto {
  @IsString()
  consultBookingId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  diagnosis?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  goals?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  contraindications?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  totalEstimate?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SessionDto)
  sessions?: SessionDto[];
}
