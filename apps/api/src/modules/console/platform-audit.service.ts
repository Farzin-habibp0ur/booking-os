import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(
    actorId: string,
    actorEmail: string,
    action: string,
    opts?: {
      targetType?: string;
      targetId?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          actorId,
          actorEmail,
          action,
          targetType: opts?.targetType,
          targetId: opts?.targetId,
          reason: opts?.reason,
          metadata: (opts?.metadata as any) ?? {},
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: action=${action}`, error);
    }
  }
}
