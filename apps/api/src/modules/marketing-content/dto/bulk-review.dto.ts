import { IsString, IsOptional, IsIn, IsArray, MaxLength } from 'class-validator';

export class BulkReviewDto {
  @IsArray()
  @IsString({ each: true })
  draftIds!: string[];

  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  action!: string;

  @IsOptional()
  @IsString()
  rejectionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}
