import { IsString, IsOptional, IsNumber, IsBoolean, IsIn, IsObject } from 'class-validator';

export class CreateBudgetEntryDto {
  @IsString()
  @IsIn([
    'CONTENT_CREATION',
    'ADVERTISING',
    'TOOLS',
    'FREELANCE',
    'OPENAI_API',
    'ANTHROPIC_API',
    'IMAGE_GENERATION',
    'SOCIAL_SCHEDULING',
    'ANALYTICS_TOOLS',
    'EMAIL_PLATFORM',
    'SEO_TOOLS',
    'STOCK_MEDIA',
    'OTHER',
  ])
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  amount!: string; // Decimal as string

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @IsIn(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME'])
  period!: string;

  @IsOptional()
  @IsNumber()
  month?: number;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
