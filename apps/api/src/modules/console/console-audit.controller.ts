import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleAuditService } from './console-audit.service';
import { ConsoleAuditQueryDto } from '../../common/dto';

@ApiTags('Console - Audit')
@Controller('admin/audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class ConsoleAuditController {
  constructor(private auditService: ConsoleAuditService) {}

  @Get()
  async list(@Query() query: ConsoleAuditQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get('action-types')
  async getActionTypes() {
    return this.auditService.getActionTypes();
  }
}
