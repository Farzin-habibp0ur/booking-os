import { IsString, IsNumber, IsOptional, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  paymentId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}
