import { PartialType } from '@nestjs/mapped-types';
import { CreateContentDraftDto } from './create-content-draft.dto';

export class UpdateContentDraftDto extends PartialType(CreateContentDraftDto) {}
