import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleSupportService } from './console-support.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import {
  ConsoleSupportCaseQueryDto,
  CreateSupportCaseDto,
  UpdateSupportCaseDto,
  AddSupportCaseNoteDto,
} from '../../common/dto';

@ApiTags('Console - Support')
@Controller('admin/support-cases')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleSupportController {
  constructor(
    private supportService: ConsoleSupportService,
    private auditService: PlatformAuditService,
  ) {}

  @Get()
  async list(@Query() query: ConsoleSupportCaseQueryDto) {
    return this.supportService.findAll(query);
  }

  @Post()
  async create(
    @Body() body: CreateSupportCaseDto,
    @CurrentUser() user: { sub: string; email: string; name?: string },
  ) {
    const result = await this.supportService.create(body, user.sub);

    this.auditService.log(user.sub, user.email, 'SUPPORT_CASE_CREATE', {
      targetType: 'SUPPORT_CASE',
      targetId: result.id,
      metadata: { businessId: body.businessId, subject: body.subject },
    });

    return result;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.supportService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSupportCaseDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.supportService.update(id, body);

    this.auditService.log(user.sub, user.email, 'SUPPORT_CASE_UPDATE', {
      targetType: 'SUPPORT_CASE',
      targetId: id,
      metadata: { changes: body },
    });

    return result;
  }

  @Post(':id/notes')
  async addNote(
    @Param('id') id: string,
    @Body() body: AddSupportCaseNoteDto,
    @CurrentUser() user: { sub: string; email: string; name?: string },
  ) {
    return this.supportService.addNote(id, body, user.sub, user.name || user.email);
  }
}
