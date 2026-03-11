import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePackageDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsNumber()
  @Min(1)
  totalSessions!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  validityDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  memberOnly?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedMembershipTiers?: string[];
}
