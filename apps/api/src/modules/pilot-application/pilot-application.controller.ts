import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CreatePilotApplicationDto } from './dto/create-pilot-application.dto';
import { UpdatePilotApplicationDto } from './dto/update-pilot-application.dto';
import { PilotApplicationService } from './pilot-application.service';

@ApiTags('Pilot Applications')
@Controller('pilot-applications')
export class PilotApplicationController {
  constructor(private pilotApplications: PilotApplicationService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  create(
    @Body() body: CreatePilotApplicationDto,
    @Headers('referer') referrer?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pilotApplications.create(body, { referrer, userAgent });
  }
}

@ApiTags('Admin Pilot Applications')
@Controller('admin/pilot-applications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminPilotApplicationController {
  constructor(private pilotApplications: PilotApplicationService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pilotApplications.findAll({
      status,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePilotApplicationDto) {
    return this.pilotApplications.update(id, body);
  }
}
