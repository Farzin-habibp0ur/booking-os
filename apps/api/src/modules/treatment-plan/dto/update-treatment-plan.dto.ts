import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class UpdateTreatmentPlanDto {
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
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class AddSessionDto {
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

export class UpdateSessionDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
