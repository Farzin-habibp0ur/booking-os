import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateTestDriveDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsDateString()
  startTime!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
