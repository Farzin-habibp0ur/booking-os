import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class UpdateTestDriveDto {
  @IsString()
  @IsOptional()
  @IsIn(['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'])
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  feedback?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
