import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdatePaymentDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reference?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
