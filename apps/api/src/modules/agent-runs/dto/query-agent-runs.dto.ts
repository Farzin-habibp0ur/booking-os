import { IsOptional, IsString, IsDateString } from 'class-validator';

export class QueryAgentRunsDto {
  @IsOptional()
  @IsString()
  agentType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  skip?: string;

  @IsOptional()
  @IsString()
  take?: string;
}
