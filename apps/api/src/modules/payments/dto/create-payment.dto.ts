import { IsString, IsNumber, IsOptional, IsIn, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['CASH', 'CARD', 'BANK_TRANSFER', 'STRIPE', 'OTHER'])
  method!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reference?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
