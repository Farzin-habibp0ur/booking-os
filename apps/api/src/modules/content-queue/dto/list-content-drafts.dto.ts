import { IsOptional, IsString } from 'class-validator';

export class ListContentDraftsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  pillar?: string;

  @IsOptional()
  @IsString()
  skip?: string;

  @IsOptional()
  @IsString()
  take?: string;
}
