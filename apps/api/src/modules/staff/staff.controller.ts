import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StaffService } from './staff.service';
import { AvailabilityService } from '../availability/availability.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';

@Controller('staff')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class StaffController {
  constructor(
    private staffService: StaffService,
    private availabilityService: AvailabilityService,
  ) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.staffService.findAll(businessId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@BusinessId() businessId: string, @Body() body: { name: string; email: string; password: string; role: string }) {
    return this.staffService.create(businessId, body);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: any) {
    return this.staffService.update(businessId, id, body);
  }

  @Delete(':id')
  @Roles('OWNER')
  deactivate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.deactivate(businessId, id);
  }

  @Get(':id/working-hours')
  getWorkingHours(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.availabilityService.getStaffWorkingHours(businessId, id);
  }

  @Patch(':id/working-hours')
  @Roles('OWNER', 'ADMIN')
  setWorkingHours(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: { hours: { dayOfWeek: number; startTime: string; endTime: string; isOff: boolean }[] }) {
    return this.availabilityService.setStaffWorkingHours(businessId, id, body.hours);
  }

  @Get(':id/time-off')
  getTimeOff(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.availabilityService.getStaffTimeOff(businessId, id);
  }

  @Post(':id/time-off')
  @Roles('OWNER', 'ADMIN')
  addTimeOff(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: { startDate: string; endDate: string; reason?: string }) {
    return this.availabilityService.addTimeOff(businessId, id, body);
  }

  @Delete(':id/time-off/:timeOffId')
  @Roles('OWNER', 'ADMIN')
  removeTimeOff(@BusinessId() businessId: string, @Param('timeOffId') timeOffId: string) {
    return this.availabilityService.removeTimeOff(businessId, timeOffId);
  }
}
