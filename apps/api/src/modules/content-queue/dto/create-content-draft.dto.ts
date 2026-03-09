import { IsString, IsOptional, IsDateString, MaxLength, IsIn } from 'class-validator';

const CONTENT_TYPES = [
  'BLOG_POST',
  'SOCIAL_POST',
  'EMAIL',
  'CASE_STUDY',
  'VIDEO_SCRIPT',
  'NEWSLETTER',
];
const CHANNELS = ['BLOG', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'EMAIL', 'YOUTUBE'];
const PILLARS = [
  'INDUSTRY_INSIGHTS',
  'PRODUCT_EDUCATION',
  'CUSTOMER_SUCCESS',
  'THOUGHT_LEADERSHIP',
  'TECHNICAL',
];

export class CreateContentDraftDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(50000)
  body!: string;

  @IsString()
  @IsIn(CONTENT_TYPES)
  contentType!: string;

  @IsString()
  @IsIn(CHANNELS)
  channel!: string;

  @IsOptional()
  @IsString()
  @IsIn(PILLARS)
  pillar?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  metadata?: any;
}
