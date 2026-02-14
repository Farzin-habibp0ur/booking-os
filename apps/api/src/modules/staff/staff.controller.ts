import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StaffService } from './staff.service';
import { AvailabilityService } from '../availability/availability.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@Controller('staff')
@UseGuards(AuthGuard('jwt'), TenantGuard)
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
  create(@BusinessId() businessId: string, @Body() body: { name: string; email: string; password: string; role: string }) {
    return this.staffService.create(businessId, body);
  }

  @Patch(':id')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: any) {
    return this.staffService.update(businessId, id, body);
  }

  @Delete(':id')
  deactivate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.deactivate(businessId, id);
  }

  @Get(':id/working-hours')
  getWorkingHours(@Param('id') id: string) {
    return this.availabilityService.getStaffWorkingHours(id);
  }

  @Patch(':id/working-hours')
  setWorkingHours(@Param('id') id: string, @Body() body: { hours: { dayOfWeek: number; startTime: string; endTime: string; isOff: boolean }[] }) {
    return this.availabilityService.setStaffWorkingHours(id, body.hours);
  }

  @Get(':id/time-off')
  getTimeOff(@Param('id') id: string) {
    return this.availabilityService.getStaffTimeOff(id);
  }

  @Post(':id/time-off')
  addTimeOff(@Param('id') id: string, @Body() body: { startDate: string; endDate: string; reason?: string }) {
    return this.availabilityService.addTimeOff(id, body);
  }

  @Delete(':id/time-off/:timeOffId')
  removeTimeOff(@Param('timeOffId') timeOffId: string) {
    return this.availabilityService.removeTimeOff(timeOffId);
  }
}
