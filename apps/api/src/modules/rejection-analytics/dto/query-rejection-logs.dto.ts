import { IsOptional, IsString, IsDateString } from 'class-validator';

export class QueryRejectionLogsDto {
  @IsOptional()
  @IsString()
  gate?: string;

  @IsOptional()
  @IsString()
  rejectionCode?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

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
