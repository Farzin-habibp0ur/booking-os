import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class ListRefundsDto {
  @IsString()
  @IsOptional()
  paymentId?: string;

  @IsNumberString()
  @IsOptional()
  skip?: string;

  @IsNumberString()
  @IsOptional()
  take?: string;
}
