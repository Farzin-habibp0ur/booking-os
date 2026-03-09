import { IsString, IsOptional, IsArray, IsBoolean, MaxLength } from 'class-validator';

export class UpdateSequenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  steps?: any[];

  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @IsOptional()
  @IsString()
  stopOnEvent?: string;

  @IsOptional()
  metadata?: any;
}
