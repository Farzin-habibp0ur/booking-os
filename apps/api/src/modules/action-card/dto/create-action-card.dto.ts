import { IsString, IsOptional, IsIn, IsInt, IsDateString, MaxLength, Min, Max } from 'class-validator';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const SOURCE_TYPES = [
  'AGENT',
  'SYSTEM',
  'AI',
  'MANUAL',
  'WAITLIST',
  'RETENTION',
  'DATA_HYGIENE',
  'SCHEDULING_OPTIMIZER',
  'QUOTE_FOLLOWUP',
];

export class CreateActionCardDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsIn(PRIORITIES)
  priority!: string;

  @IsString()
  sourceAgentId!: string;

  @IsString()
  @IsIn(SOURCE_TYPES)
  sourceType!: string;

  @IsOptional()
  actionData?: any;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
