import { IsString, IsOptional, IsIn, IsNumber, MaxLength, Min, Max } from 'class-validator';

const ELEMENT_TYPES = [
  'subject_line',
  'hero_image',
  'cta_text',
  'cta_color',
  'body_length',
  'headline_style',
  'send_time',
  'social_format',
  'thumbnail',
  'opening_hook',
];

export class CreateAbTestDto {
  @IsString()
  @MaxLength(500)
  name!: string;

  @IsString()
  @IsIn(ELEMENT_TYPES)
  elementType!: string;

  controlVariant!: any;

  testVariant!: any;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  winThreshold?: number;
}
