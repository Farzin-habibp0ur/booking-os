import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const PILOT_APPLICATION_STATUSES = [
  'NEW',
  'CONTACTED',
  'ACCEPTED',
  'REJECTED',
  'WAITLIST_YEAR_2',
] as const;

export class UpdatePilotApplicationDto {
  @IsOptional()
  @IsIn(PILOT_APPLICATION_STATUSES)
  status?: (typeof PILOT_APPLICATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
