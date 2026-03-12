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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto, UpdateVehicleDto, ListVehiclesDto } from './dto';

@Controller('vehicles')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  create(
    @BusinessId() businessId: string,
    @Body() body: CreateVehicleDto,
    @CurrentUser() user: any,
  ) {
    return this.vehicleService.create(businessId, body, user.id);
  }

  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.vehicleService.stats(businessId);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: ListVehiclesDto) {
    return this.vehicleService.findAll(businessId, query);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.vehicleService.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateVehicleDto,
  ) {
    return this.vehicleService.update(businessId, id, body);
  }

  @Delete(':id')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.vehicleService.remove(businessId, id);
  }
}
