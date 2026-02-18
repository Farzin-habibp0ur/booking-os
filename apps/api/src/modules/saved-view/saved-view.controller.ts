import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SavedViewService } from './saved-view.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import {
  CreateSavedViewDto,
  UpdateSavedViewDto,
  ShareSavedViewDto,
} from '../../common/dto';

@ApiTags('Saved Views')
@Controller('saved-views')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class SavedViewController {
  constructor(private savedViewService: SavedViewService) {}

  @Get()
  list(
    @BusinessId() businessId: string,
    @Req() req: any,
    @Query('page') page: string,
  ) {
    return this.savedViewService.findByPage(businessId, req.user.sub, page);
  }

  @Get('pinned')
  pinned(@BusinessId() businessId: string, @Req() req: any) {
    return this.savedViewService.findPinned(businessId, req.user.sub);
  }

  @Get('dashboard')
  dashboard(@BusinessId() businessId: string, @Req() req: any) {
    return this.savedViewService.findDashboard(businessId, req.user.sub);
  }

  @Post()
  create(
    @BusinessId() businessId: string,
    @Req() req: any,
    @Body() body: CreateSavedViewDto,
  ) {
    return this.savedViewService.create(businessId, req.user.sub, body);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateSavedViewDto,
  ) {
    return this.savedViewService.update(
      id,
      businessId,
      req.user.sub,
      req.user.role,
      body,
    );
  }

  @Delete(':id')
  remove(
    @BusinessId() businessId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.savedViewService.remove(id, businessId, req.user.sub, req.user.role);
  }

  @Patch(':id/share')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  share(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: ShareSavedViewDto,
  ) {
    return this.savedViewService.share(id, businessId, body.isShared);
  }
}
