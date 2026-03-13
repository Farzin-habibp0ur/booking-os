import { IsString, IsIn } from 'class-validator';

export class UpdateAutonomySettingDto {
  @IsString()
  @IsIn(['OFF', 'SUGGEST', 'AUTO_WITH_REVIEW', 'FULL_AUTO'])
  level!: string;
}
