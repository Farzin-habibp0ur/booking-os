import { IsString, IsNumber, IsOptional, IsIn, Min, MaxLength } from 'class-validator';

export class RecordPaymentDto {
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
