import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class ChangeStageDto {
  @IsString()
  @IsIn(['INQUIRY', 'QUALIFIED', 'TEST_DRIVE', 'NEGOTIATION', 'FINANCE', 'CLOSED_WON', 'CLOSED_LOST'])
  stage!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  lostReason?: string;
}
