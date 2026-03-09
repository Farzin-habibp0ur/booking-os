import { IsString, IsOptional, IsDateString, IsNumberString } from 'class-validator';

export class ListPaymentsDto {
  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsNumberString()
  @IsOptional()
  skip?: string;

  @IsNumberString()
  @IsOptional()
  take?: string;
}
