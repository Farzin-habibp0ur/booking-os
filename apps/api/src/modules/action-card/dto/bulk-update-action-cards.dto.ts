import { IsString, IsArray, IsIn } from 'class-validator';

const STATUSES = ['APPROVED', 'DISMISSED'];

export class BulkUpdateActionCardsDto {
  @IsArray()
  @IsString({ each: true })
  cardIds!: string[];

  @IsString()
  @IsIn(STATUSES)
  status!: string;
}
