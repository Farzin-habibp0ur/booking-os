import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TemplateService } from './template.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateTemplateDto, UpdateTemplateDto } from '../../common/dto';

@ApiTags('Templates')
@Controller('templates')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.templateService.findAll(businessId);
  }

  @Get(':id')
  detail(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.templateService.findById(businessId, id);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateTemplateDto) {
    return this.templateService.create(businessId, body);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateTemplateDto,
  ) {
    return this.templateService.update(businessId, id, body);
  }

  @Delete(':id')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.templateService.remove(businessId, id);
  }
}
