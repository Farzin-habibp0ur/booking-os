import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ListVehiclesDto {
  @IsString()
  @IsOptional()
  @IsIn(['IN_STOCK', 'RESERVED', 'SOLD', 'IN_TRANSIT', 'TRADE_IN', 'ARCHIVED'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['NEW', 'USED', 'CERTIFIED_PRE_OWNED'])
  condition?: string;

  @IsString()
  @IsOptional()
  make?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1900)
  yearMin?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  yearMax?: number;

  @Type(() => Number)
  @IsOptional()
  @Min(0)
  priceMin?: number;

  @Type(() => Number)
  @IsOptional()
  @Min(0)
  priceMax?: number;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'askingPrice', 'year', 'mileage'])
  sortBy?: string;

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  skip?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  take?: number;
}
