import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { PackBuilderService } from './pack-builder.service';
import { CreatePackDto, UpdatePackDto } from '../../common/dto';

@ApiTags('Pack Builder')
@Controller('admin/packs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class PackBuilderController {
  constructor(private packBuilderService: PackBuilderService) {}

  @Get()
  listPacks() {
    return this.packBuilderService.listPacks();
  }

  @Get(':slug')
  getPackBySlug(@Param('slug') slug: string) {
    return this.packBuilderService.getPackBySlug(slug);
  }

  @Get(':slug/versions')
  getPackVersions(@Param('slug') slug: string) {
    return this.packBuilderService.getPackVersions(slug);
  }

  @Post()
  createPack(@Body() body: CreatePackDto) {
    return this.packBuilderService.createPack(body);
  }

  @Patch(':id')
  updatePack(@Param('id') id: string, @Body() body: UpdatePackDto) {
    return this.packBuilderService.updatePack(id, body);
  }

  @Post(':id/publish')
  publishPack(@Param('id') id: string) {
    return this.packBuilderService.publishPack(id);
  }

  @Post(':slug/new-version')
  createNewVersion(@Param('slug') slug: string) {
    return this.packBuilderService.createNewVersion(slug);
  }

  @Delete(':id')
  deletePack(@Param('id') id: string) {
    return this.packBuilderService.deletePack(id);
  }
}
