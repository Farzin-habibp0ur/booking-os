import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RecurringClassService } from './recurring-class.service';
import { CreateRecurringClassDto, UpdateRecurringClassDto } from './dto';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';

@ApiTags('Recurring Classes')
@Controller('recurring-classes')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class RecurringClassController {
  constructor(private service: RecurringClassService) {}

  @Post()
  @Roles('ADMIN')
  create(@BusinessId() businessId: string, @Body() dto: CreateRecurringClassDto) {
    return this.service.create(businessId, dto);
  }

  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.service.findAll(businessId);
  }

  @Get('schedule')
  getSchedule(@BusinessId() businessId: string, @Query('week') week: string) {
    return this.service.getWeeklySchedule(businessId, week);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringClassDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @Post(':id/enroll')
  enroll(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body('customerId') customerId: string,
  ) {
    return this.service.enroll(businessId, id, customerId);
  }
}
