import { Controller, Get, Param } from '@nestjs/common';
import { VerticalPackService } from './vertical-pack.service';

@Controller('vertical-packs')
export class VerticalPackController {
  constructor(private verticalPackService: VerticalPackService) {}

  @Get(':name')
  getPack(@Param('name') name: string) {
    return this.verticalPackService.getPack(name);
  }
}
