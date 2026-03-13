import { IsOptional, IsString, IsBoolean, IsIn, IsObject } from 'class-validator';

export class UpdatePlatformConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['LOCKED', 'ACTIVE', 'SCALING'])
  phase?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @IsOptional()
  @IsObject()
  postingSchedule?: Record<string, any>;

  @IsOptional()
  @IsObject()
  constraints?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
