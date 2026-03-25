import { IsString, IsNumber, Min } from 'class-validator';

export class RedeemCreditDto {
  @IsString()
  bookingId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}
