import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LineItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsString()
  @IsOptional()
  serviceId?: string;
}

export class CreateInvoiceDto {
  @IsString()
  customerId!: string;

  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  quoteId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  taxRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  terms?: string;
}
