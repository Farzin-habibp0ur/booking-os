import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { DeadLetterQueueService } from './dead-letter.service';

@ApiTags('Admin - DLQ')
@Controller('admin/dlq')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@AllowAnyRole()
@Roles('SUPER_ADMIN')
export class DeadLetterController {
  constructor(private readonly dlqService: DeadLetterQueueService) {}

  @Get()
  async list(
    @Query('queue') queue?: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dlqService.list({
      queue,
      since: since ? new Date(since) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('stats')
  async getStats() {
    return this.dlqService.getStats();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const entry = await this.dlqService.get(id);
    if (!entry) {
      throw new NotFoundException(`DLQ entry ${id} not found`);
    }
    return entry;
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id') id: string) {
    const success = await this.dlqService.retry(id);
    if (!success) {
      throw new NotFoundException(`DLQ entry ${id} not found`);
    }
    return { success: true, id };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const success = await this.dlqService.retry(id);
    if (!success) {
      throw new NotFoundException(`DLQ entry ${id} not found`);
    }
    return { success: true, id };
  }

  @Delete()
  async purge(@Query('queue') queue?: string, @Query('before') before?: string) {
    const count = await this.dlqService.purge({
      queue,
      before: before ? new Date(before) : undefined,
    });
    return { purged: count };
  }
}
