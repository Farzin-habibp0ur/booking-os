import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

const CONTENT_TYPES = [
  'BLOG_POST',
  'SOCIAL_POST',
  'EMAIL',
  'CASE_STUDY',
  'VIDEO_SCRIPT',
  'NEWSLETTER',
];

const TIERS = ['GREEN', 'YELLOW', 'RED'];

const CHANNELS = ['BLOG', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'EMAIL', 'YOUTUBE', 'TIKTOK'];

const PILLARS = [
  'INDUSTRY_INSIGHTS',
  'PRODUCT_EDUCATION',
  'CUSTOMER_SUCCESS',
  'THOUGHT_LEADERSHIP',
  'TECHNICAL',
];

const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'YOUTUBE', 'PINTEREST', 'TWITTER', 'BLOG'];

export class CreateContentDraftDto {
  @IsString()
  @IsIn(CONTENT_TYPES)
  contentType!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(50000)
  body!: string;

  @IsString()
  @IsIn(TIERS)
  tier!: string;

  @IsString()
  @IsIn(CHANNELS)
  channel!: string;

  @IsString()
  @IsIn(PILLARS)
  pillar!: string;

  @IsString()
  agentId!: string;

  @IsOptional()
  @IsString()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  slug?: string;

  @IsOptional()
  metadata?: any;
}
