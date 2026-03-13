import { IsOptional, IsString, IsIn } from 'class-validator';

const STATUSES = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'];

export class UpdateAbTestDto {
  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  results?: any;

  @IsOptional()
  @IsString()
  winnerVariantId?: string;
}
