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
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { EmailSequenceService } from './email-sequences.service';
import { CreateSequenceDto, UpdateSequenceDto, EnrollSequenceDto } from './dto';

@Controller('email-sequences')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class EmailSequenceController {
  constructor(private readonly service: EmailSequenceService) {}

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: { type?: string; isActive?: string }) {
    return this.service.findAll(businessId, query);
  }

  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@BusinessId() businessId: string, @Body() dto: CreateSequenceDto) {
    return this.service.createSequence(businessId, dto);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSequenceDto,
  ) {
    return this.service.updateSequence(businessId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.deleteSequence(businessId, id);
  }

  @Post(':id/enroll')
  @Roles('OWNER', 'ADMIN')
  enroll(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: EnrollSequenceDto,
  ) {
    return this.service.enroll(businessId, id, dto);
  }

  @Get(':id/enrollments')
  getEnrollments(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Query() query: { status?: string },
  ) {
    return this.service.getEnrollments(businessId, id, query);
  }

  @Post('enrollments/:enrollmentId/cancel')
  @Roles('OWNER', 'ADMIN')
  cancelEnrollment(@BusinessId() businessId: string, @Param('enrollmentId') enrollmentId: string) {
    return this.service.cancelEnrollment(businessId, enrollmentId);
  }

  @Post('enrollments/:enrollmentId/pause')
  @Roles('OWNER', 'ADMIN')
  pauseEnrollment(@BusinessId() businessId: string, @Param('enrollmentId') enrollmentId: string) {
    return this.service.pauseEnrollment(businessId, enrollmentId);
  }

  @Post('enrollments/:enrollmentId/resume')
  @Roles('OWNER', 'ADMIN')
  resumeEnrollment(@BusinessId() businessId: string, @Param('enrollmentId') enrollmentId: string) {
    return this.service.resumeEnrollment(businessId, enrollmentId);
  }

  @Post('seed')
  @Roles('OWNER', 'ADMIN')
  seed() {
    return this.service.seedDefaultSequences();
  }
}
