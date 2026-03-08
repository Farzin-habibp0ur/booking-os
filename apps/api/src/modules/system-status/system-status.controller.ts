import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemStatusService } from './system-status.service';

@ApiTags('System Status')
@Controller('system-status')
export class SystemStatusController {
  constructor(private readonly systemStatusService: SystemStatusService) {}

  @Get()
  @ApiOperation({ summary: 'Get system status and health metrics' })
  @ApiResponse({
    status: 200,
    description: 'System status retrieved successfully',
    schema: {
      example: {
        status: 'healthy',
        uptime: 12345,
        version: '0.1.0',
        environment: 'production',
        services: {
          database: { status: 'ok', latencyMs: 5 },
          redis: { status: 'ok', latencyMs: 2 },
        },
        cron: {
          enabled: true,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: ['ai-processing', 'messaging'],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      },
    },
  })
  async getSystemStatus() {
    return this.systemStatusService.getSystemStatus();
  }
}
