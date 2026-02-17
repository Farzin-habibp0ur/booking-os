import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { LocationService } from './location.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import {
  CreateLocationDto,
  UpdateLocationDto,
  CreateResourceDto,
  UpdateResourceDto,
  AssignStaffToLocationDto,
} from '../../common/dto';

@ApiTags('Locations')
@Controller('locations')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.locationService.findAll(businessId);
  }

  @Get(':id')
  detail(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.locationService.findById(businessId, id);
  }

  @Post()
  @Roles('ADMIN')
  create(@BusinessId() businessId: string, @Body() body: CreateLocationDto) {
    return this.locationService.create(businessId, body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateLocationDto,
  ) {
    return this.locationService.update(businessId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.locationService.softDelete(businessId, id);
  }

  // ---- Resources ----

  @Get(':id/resources')
  listResources(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.locationService.findResources(businessId, id);
  }

  @Post(':id/resources')
  @Roles('ADMIN')
  createResource(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: CreateResourceDto,
  ) {
    return this.locationService.createResource(businessId, id, body);
  }

  @Patch(':id/resources/:resourceId')
  @Roles('ADMIN')
  updateResource(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
    @Body() body: UpdateResourceDto,
  ) {
    return this.locationService.updateResource(businessId, id, resourceId, body);
  }

  @Delete(':id/resources/:resourceId')
  @Roles('ADMIN')
  removeResource(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.locationService.softDeleteResource(businessId, id, resourceId);
  }

  // ---- Staff Assignments ----

  @Post(':id/staff')
  @Roles('ADMIN')
  assignStaff(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: AssignStaffToLocationDto,
  ) {
    return this.locationService.assignStaff(businessId, id, body.staffId);
  }

  @Delete(':id/staff/:staffId')
  @Roles('ADMIN')
  unassignStaff(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    return this.locationService.unassignStaff(businessId, id, staffId);
  }
}
