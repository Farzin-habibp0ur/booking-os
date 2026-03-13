import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class ReviewContentDraftDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT', 'EDIT'])
  action!: string;

  @IsOptional()
  @IsString()
  rejectionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  editedBody?: string;
}
