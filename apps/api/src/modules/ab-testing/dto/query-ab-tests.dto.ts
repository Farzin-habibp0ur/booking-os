import { IsOptional, IsString } from 'class-validator';

export class QueryAbTestsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  elementType?: string;

  @IsOptional()
  @IsString()
  skip?: string;

  @IsOptional()
  @IsString()
  take?: string;
}
