import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VerticalPackService } from './vertical-pack.service';

@ApiTags('Vertical Packs')
@Controller('vertical-packs')
export class VerticalPackController {
  constructor(private verticalPackService: VerticalPackService) {}

  @Get(':name')
  getPack(@Param('name') name: string) {
    return this.verticalPackService.getPack(name);
  }
}
