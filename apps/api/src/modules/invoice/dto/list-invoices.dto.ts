import { IsString, IsOptional, IsDateString, IsNumberString } from 'class-validator';

export class ListInvoicesDto {
  @IsString()
  @IsOptional()
  status?: string;

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
