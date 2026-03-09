import { IsString, IsEmail, IsOptional, MaxLength } from 'class-validator';

export class EnrollSequenceDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  metadata?: any;
}
