import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { TestDriveService } from './test-drive.service';
import { CreateTestDriveDto, UpdateTestDriveDto } from './dto';

@Controller('test-drives')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class TestDriveController {
  constructor(private readonly testDriveService: TestDriveService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateTestDriveDto) {
    return this.testDriveService.create(businessId, body);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateTestDriveDto,
  ) {
    return this.testDriveService.update(businessId, id, body);
  }

  @Get()
  findAll(
    @BusinessId() businessId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.testDriveService.findAll(businessId, { vehicleId, customerId });
  }
}
