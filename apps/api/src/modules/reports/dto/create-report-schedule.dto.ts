import {
  IsString,
  IsArray,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class CreateReportScheduleDto {
  @IsString()
  @IsIn([
    'bookings-over-time',
    'revenue-over-time',
    'no-show-rate',
    'service-breakdown',
    'staff-performance',
    'status-breakdown',
    'peak-hours',
    'consult-conversion',
  ])
  reportType!: string;

  @IsString()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  recipients!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hour?: number;

  @IsOptional()
  @IsString()
  timezone?: string;
}
