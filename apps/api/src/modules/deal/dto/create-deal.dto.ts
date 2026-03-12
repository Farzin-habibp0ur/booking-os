import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsIn,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateDealDto {
  @IsString()
  customerId!: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsString()
  @IsOptional()
  @IsIn([
    'INQUIRY',
    'QUALIFIED',
    'TEST_DRIVE',
    'NEGOTIATION',
    'FINANCE',
    'CLOSED_WON',
    'CLOSED_LOST',
  ])
  stage?: string;

  @IsString()
  @IsOptional()
  @IsIn(['WALK_IN', 'PHONE', 'WEBSITE', 'WHATSAPP', 'REFERRAL'])
  source?: string;

  @IsString()
  @IsOptional()
  @IsIn(['NEW_PURCHASE', 'USED_PURCHASE', 'TRADE_IN', 'LEASE'])
  dealType?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  dealValue?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tradeInValue?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsDateString()
  @IsOptional()
  expectedCloseDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  notes?: string;
}
