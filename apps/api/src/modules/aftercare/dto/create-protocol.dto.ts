import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStepDto {
  @IsNumber()
  @Min(1)
  sequenceOrder!: number;

  @IsNumber()
  @Min(0)
  delayHours!: number;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  instructions?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProtocolDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStepDto)
  steps!: CreateStepDto[];
}

export class UpdateProtocolDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateStepDto)
  steps?: CreateStepDto[];
}
