import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

const STATUSES = ['PENDING', 'APPROVED', 'DISMISSED', 'SNOOZED', 'EXECUTED', 'EXPIRED'];

export class UpdateActionCardDto {
  @IsString()
  @IsIn(STATUSES)
  status!: string;

  @IsOptional()
  @IsDateString()
  snoozedUntil?: string;
}
