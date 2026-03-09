import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class UpdateContentDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string;

  @IsOptional()
  @IsString()
  @IsIn(['BLOG_POST', 'SOCIAL_POST', 'EMAIL', 'CASE_STUDY', 'VIDEO_SCRIPT', 'NEWSLETTER'])
  contentType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['BLOG', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'EMAIL', 'YOUTUBE'])
  channel?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'INDUSTRY_INSIGHTS',
    'PRODUCT_EDUCATION',
    'CUSTOMER_SUCCESS',
    'THOUGHT_LEADERSHIP',
    'TECHNICAL',
  ])
  pillar?: string;

  @IsOptional()
  metadata?: any;
}
