import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum PhotoType {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
  PROGRESS = 'PROGRESS',
}

export class UploadClinicalPhotoDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsEnum(PhotoType)
  type!: PhotoType;

  @IsString()
  bodyArea!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}

export class CreateComparisonDto {
  @IsString()
  customerId!: string;

  @IsString()
  beforePhotoId!: string;

  @IsString()
  afterPhotoId!: string;

  @IsString()
  bodyArea!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListPhotosQueryDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsEnum(PhotoType)
  type?: PhotoType;

  @IsOptional()
  @IsString()
  bodyArea?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
