import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsolePacksService } from './console-packs.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import {
  ConsoleRolloutDto,
  ConsoleRollbackDto,
  ConsolePinDto,
} from '../../common/dto';

@ApiTags('Console - Packs')
@Controller('admin/packs-console')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsolePacksController {
  constructor(
    private packsService: ConsolePacksService,
    private auditService: PlatformAuditService,
  ) {}

  @Get('registry')
  async getRegistry(
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.getRegistry();

    this.auditService.log(user.sub, user.email, 'PACK_REGISTRY_VIEW');

    return result;
  }

  @Get(':slug/detail')
  async getPackDetail(
    @Param('slug') slug: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.getPackDetail(slug);

    this.auditService.log(user.sub, user.email, 'PACK_DETAIL_VIEW', {
      targetType: 'PACK',
      targetId: slug,
    });

    return result;
  }

  @Get(':slug/versions')
  async getVersions(
    @Param('slug') slug: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.getVersions(slug);

    this.auditService.log(user.sub, user.email, 'PACK_VERSIONS_VIEW', {
      targetType: 'PACK',
      targetId: slug,
    });

    return result;
  }

  @Post(':slug/versions/:version/rollout')
  async startOrAdvanceRollout(
    @Param('slug') slug: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: ConsoleRolloutDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.startOrAdvanceRollout(
      slug,
      version,
      body.targetPercent,
    );

    this.auditService.log(user.sub, user.email, 'PACK_ROLLOUT_ADVANCE', {
      targetType: 'PACK_VERSION',
      targetId: `${slug}/v${version}`,
      reason: body.reason,
      metadata: { targetPercent: body.targetPercent },
    });

    return result;
  }

  @Post(':slug/versions/:version/pause')
  async pauseRollout(
    @Param('slug') slug: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.pauseRollout(slug, version);

    this.auditService.log(user.sub, user.email, 'PACK_ROLLOUT_PAUSE', {
      targetType: 'PACK_VERSION',
      targetId: `${slug}/v${version}`,
    });

    return result;
  }

  @Post(':slug/versions/:version/resume')
  async resumeRollout(
    @Param('slug') slug: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.resumeRollout(slug, version);

    this.auditService.log(user.sub, user.email, 'PACK_ROLLOUT_RESUME', {
      targetType: 'PACK_VERSION',
      targetId: `${slug}/v${version}`,
    });

    return result;
  }

  @Post(':slug/versions/:version/rollback')
  async rollbackVersion(
    @Param('slug') slug: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: ConsoleRollbackDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.rollbackVersion(slug, version, body.reason);

    this.auditService.log(user.sub, user.email, 'PACK_ROLLOUT_ROLLBACK', {
      targetType: 'PACK_VERSION',
      targetId: `${slug}/v${version}`,
      reason: body.reason,
    });

    return result;
  }

  @Get(':slug/pins')
  async getPins(
    @Param('slug') slug: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.getPins(slug);

    this.auditService.log(user.sub, user.email, 'PACK_PINS_VIEW', {
      targetType: 'PACK',
      targetId: slug,
    });

    return result;
  }

  @Post(':slug/pins')
  async pinBusiness(
    @Param('slug') slug: string,
    @Body() body: ConsolePinDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.pinBusiness(
      slug,
      body.businessId,
      body.pinnedVersion,
      body.reason,
      user.sub,
    );

    this.auditService.log(user.sub, user.email, 'PACK_TENANT_PIN', {
      targetType: 'BUSINESS',
      targetId: body.businessId,
      reason: body.reason,
      metadata: { packSlug: slug, pinnedVersion: body.pinnedVersion },
    });

    return result;
  }

  @Delete(':slug/pins/:businessId')
  async unpinBusiness(
    @Param('slug') slug: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.packsService.unpinBusiness(slug, businessId);

    this.auditService.log(user.sub, user.email, 'PACK_TENANT_UNPIN', {
      targetType: 'BUSINESS',
      targetId: businessId,
      metadata: { packSlug: slug },
    });

    return result;
  }
}
