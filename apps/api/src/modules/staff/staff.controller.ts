import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { StaffService } from './staff.service';
import { AvailabilityService } from '../availability/availability.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import {
  CreateStaffDto,
  UpdateStaffDto,
  SetWorkingHoursDto,
  AddTimeOffDto,
  InviteStaffDto,
  UpdatePreferencesDto,
  SetStaffServicePricingDto,
} from '../../common/dto';

@ApiTags('Staff')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('staff')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class StaffController {
  constructor(
    private staffService: StaffService,
    private availabilityService: AvailabilityService,
  ) {}

  @Patch('me/preferences')
  updatePreferences(@Req() req: any, @Body() body: UpdatePreferencesDto) {
    return this.staffService.updatePreferences(req.user.sub, body as Record<string, unknown>);
  }

  @Get()
  @Roles('ADMIN')
  list(
    @BusinessId() businessId: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.staffService.findAll(businessId, { sortBy, sortOrder });
  }

  @Post()
  @Roles('ADMIN')
  create(@BusinessId() businessId: string, @Body() body: CreateStaffDto) {
    return this.staffService.create(businessId, body);
  }

  @Post('invite')
  @Roles('ADMIN')
  invite(@BusinessId() businessId: string, @Body() body: InviteStaffDto) {
    return this.staffService.inviteStaff(businessId, body);
  }

  @Post(':id/resend-invite')
  @Roles('ADMIN')
  resendInvite(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.resendInvite(businessId, id);
  }

  @Delete(':id/invite')
  @Roles('ADMIN')
  revokeInvite(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.revokeInvite(businessId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: UpdateStaffDto) {
    return this.staffService.update(businessId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  deactivate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.deactivate(businessId, id);
  }

  @Get(':id/pricing')
  getServicePricing(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.getServicePricing(businessId, id);
  }

  @Patch(':id/pricing')
  @Roles('ADMIN')
  setServicePricing(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: SetStaffServicePricingDto,
  ) {
    return this.staffService.setServicePricing(businessId, id, body.overrides);
  }

  @Put(':id/services')
  @Roles('ADMIN')
  assignServices(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: { serviceIds: string[] },
  ) {
    return this.staffService.assignServices(businessId, id, body.serviceIds || []);
  }

  @Get(':id/services')
  getAssignedServices(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.staffService.getAssignedServices(businessId, id);
  }

  @Get(':id/working-hours')
  getWorkingHours(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.availabilityService.getStaffWorkingHours(businessId, id);
  }

  @Patch(':id/working-hours')
  @Roles('ADMIN', 'SERVICE_PROVIDER')
  setWorkingHours(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: SetWorkingHoursDto,
    @Req() req: any,
  ) {
    if (req.user.role === 'SERVICE_PROVIDER' && req.user.sub !== id) {
      throw new ForbiddenException('Service providers can only modify their own working hours');
    }
    return this.availabilityService.setStaffWorkingHours(businessId, id, body.hours);
  }

  @Get(':id/time-off')
  getTimeOff(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.availabilityService.getStaffTimeOff(businessId, id);
  }

  @Post(':id/time-off')
  @Roles('ADMIN', 'SERVICE_PROVIDER')
  addTimeOff(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: AddTimeOffDto,
    @Req() req: any,
  ) {
    if (req.user.role === 'SERVICE_PROVIDER' && req.user.sub !== id) {
      throw new ForbiddenException('Service providers can only modify their own time off');
    }
    return this.availabilityService.addTimeOff(businessId, id, body);
  }

  @Delete(':id/time-off/:timeOffId')
  @Roles('ADMIN', 'SERVICE_PROVIDER')
  removeTimeOff(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @Req() req: any,
  ) {
    if (req.user.role === 'SERVICE_PROVIDER' && req.user.sub !== id) {
      throw new ForbiddenException('Service providers can only modify their own time off');
    }
    return this.availabilityService.removeTimeOff(businessId, timeOffId);
  }

}
