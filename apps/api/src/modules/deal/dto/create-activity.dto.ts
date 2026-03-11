import { IsString, IsOptional, IsIn, IsDateString, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @IsIn(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'TEST_DRIVE', 'FOLLOW_UP'])
  type!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsDateString()
  @IsOptional()
  scheduledFor?: string;
}
