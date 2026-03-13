import { IsOptional, IsString, IsBoolean, IsInt, IsIn, Min, Max } from 'class-validator';

const AUTONOMY_LEVELS = ['SUGGEST', 'AUTO', 'REQUIRE_APPROVAL'];

export class UpdateAgentConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080) // max 1 week in minutes
  runIntervalMinutes?: number;

  @IsOptional()
  @IsString()
  @IsIn(AUTONOMY_LEVELS)
  autonomyLevel?: string;

  @IsOptional()
  config?: any;
}
