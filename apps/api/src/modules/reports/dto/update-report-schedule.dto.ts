import {
  IsString,
  IsArray,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateReportScheduleDto {
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  recipients?: string[];

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
