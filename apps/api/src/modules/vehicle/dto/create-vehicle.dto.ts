import {
  IsString,
  IsInt,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  MaxLength,
  Min,
  Matches,
  Length,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsOptional()
  stockNumber?: string;

  @IsString()
  @IsOptional()
  @Length(17, 17, { message: 'VIN must be exactly 17 characters' })
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { message: 'VIN contains invalid characters (no I, O, Q)' })
  vin?: string;

  @IsInt()
  @Min(1900)
  year!: number;

  @IsString()
  @MaxLength(100)
  make!: string;

  @IsString()
  @MaxLength(100)
  model!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  trim?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  mileage?: number;

  @IsString()
  @IsOptional()
  @IsIn(['NEW', 'USED', 'CERTIFIED_PRE_OWNED'])
  condition?: string;

  @IsString()
  @IsOptional()
  @IsIn(['IN_STOCK', 'RESERVED', 'SOLD', 'IN_TRANSIT', 'TRADE_IN'])
  status?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  askingPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costPrice?: number;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @IsString()
  @IsOptional()
  locationId?: string;
}
