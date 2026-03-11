import { IsString, IsOptional, MaxLength } from 'class-validator';

export class PurchasePackageDto {
  @IsString()
  customerId!: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
