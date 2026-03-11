import { IsString, IsInt, Min, Max, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateRecurringClassDto {
  @IsString()
  serviceId!: string;

  @IsString()
  staffId!: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string; // HH:mm

  @IsInt()
  @Min(1)
  maxParticipants!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
