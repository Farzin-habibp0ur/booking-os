import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DeviceTokenService {
  private readonly logger = new Logger(DeviceTokenService.name);

  constructor(private prisma: PrismaService) {}

  async register(staffId: string, businessId: string, token: string, platform: string) {
    const result = await this.prisma.deviceToken.upsert({
      where: { staffId_token: { staffId, token } },
      create: { staffId, businessId, token, platform, isActive: true },
      update: { isActive: true, platform, updatedAt: new Date() },
    });
    this.logger.log(`Device token registered for staff ${staffId} (${platform})`);
    return result;
  }

  async unregister(token: string) {
    const updated = await this.prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
    this.logger.log(`Device token deactivated: ${token.substring(0, 10)}...`);
    return updated;
  }

  async findActiveByStaff(staffId: string) {
    return this.prisma.deviceToken.findMany({
      where: { staffId, isActive: true },
    });
  }

  async findActiveByBusiness(businessId: string) {
    return this.prisma.deviceToken.findMany({
      where: { businessId, isActive: true },
    });
  }

  async deactivateStale() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.deviceToken.updateMany({
      where: { isActive: true, updatedAt: { lt: ninetyDaysAgo } },
      data: { isActive: false },
    });
    this.logger.log(`Deactivated ${result.count} stale device tokens`);
    return result;
  }
}
