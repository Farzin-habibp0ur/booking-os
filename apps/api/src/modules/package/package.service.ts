import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CreatePackageDto, UpdatePackageDto, PurchasePackageDto, RedeemPackageDto } from './dto';

@Injectable()
export class PackageService {
  private readonly logger = new Logger(PackageService.name);

  constructor(private prisma: PrismaService) {}

  private async validateWellnessVertical(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (business.verticalPack !== 'wellness') {
      throw new BadRequestException('Service packages are only available for wellness businesses');
    }
  }

  async create(businessId: string, data: CreatePackageDto) {
    await this.validateWellnessVertical(businessId);

    if (data.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: data.serviceId, businessId },
      });
      if (!service) throw new NotFoundException('Service not found');
    }

    return this.prisma.servicePackage.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        serviceId: data.serviceId,
        totalSessions: data.totalSessions,
        price: data.price,
        currency: data.currency || 'USD',
        validityDays: data.validityDays || 365,
        isActive: data.isActive ?? true,
        memberOnly: data.memberOnly ?? false,
        allowedMembershipTiers: data.allowedMembershipTiers || [],
      },
      include: { service: true },
    });
  }

  async findAll(businessId: string) {
    await this.validateWellnessVertical(businessId);

    const packages = await this.prisma.servicePackage.findMany({
      where: { businessId },
      include: {
        service: { select: { id: true, name: true } },
        _count: { select: { purchases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return packages;
  }

  async findOne(businessId: string, id: string) {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id, businessId },
      include: {
        service: { select: { id: true, name: true } },
        purchases: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            _count: { select: { redemptions: true } },
          },
          orderBy: { purchasedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async update(businessId: string, id: string, data: UpdatePackageDto) {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id, businessId },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    if (data.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: data.serviceId, businessId },
      });
      if (!service) throw new NotFoundException('Service not found');
    }

    return this.prisma.servicePackage.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
        ...(data.totalSessions !== undefined && { totalSessions: data.totalSessions }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.validityDays !== undefined && { validityDays: data.validityDays }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.memberOnly !== undefined && { memberOnly: data.memberOnly }),
        ...(data.allowedMembershipTiers !== undefined && {
          allowedMembershipTiers: data.allowedMembershipTiers,
        }),
      },
      include: { service: true },
    });
  }

  async delete(businessId: string, id: string) {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id, businessId },
      include: { _count: { select: { purchases: true } } },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    if (pkg._count.purchases > 0) {
      // Soft-deactivate instead of deleting
      return this.prisma.servicePackage.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.servicePackage.delete({ where: { id } });
  }

  async purchase(businessId: string, packageId: string, data: PurchasePackageDto) {
    await this.validateWellnessVertical(businessId);

    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id: packageId, businessId, isActive: true },
    });
    if (!pkg) throw new NotFoundException('Package not found or inactive');

    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, businessId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pkg.validityDays);

    // Create payment record if payment method provided
    let paymentId: string | undefined;
    if (data.paymentMethod) {
      const payment = await this.prisma.payment.create({
        data: {
          businessId,
          customerId: data.customerId,
          amount: Number(pkg.price),
          currency: pkg.currency.toLowerCase(),
          method: data.paymentMethod,
          status: 'COMPLETED',
          notes: `Package purchase: ${pkg.name}`,
        },
      });
      paymentId = payment.id;
    }

    return this.prisma.packagePurchase.create({
      data: {
        packageId,
        customerId: data.customerId,
        businessId,
        totalSessions: pkg.totalSessions,
        expiresAt,
        paymentId,
        notes: data.notes,
      },
      include: {
        package: { select: { id: true, name: true, totalSessions: true } },
        customer: { select: { id: true, name: true } },
        payment: true,
      },
    });
  }

  async listPurchases(businessId: string, customerId?: string, status?: string) {
    const where: any = { businessId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    return this.prisma.packagePurchase.findMany({
      where,
      include: {
        package: {
          select: { id: true, name: true, serviceId: true, service: { select: { id: true, name: true } } },
        },
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { redemptions: true } },
      },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async getPurchase(businessId: string, purchaseId: string) {
    const purchase = await this.prisma.packagePurchase.findFirst({
      where: { id: purchaseId, businessId },
      include: {
        package: { include: { service: { select: { id: true, name: true } } } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        payment: true,
        redemptions: {
          include: {
            booking: {
              select: { id: true, startTime: true, status: true, service: { select: { name: true } } },
            },
          },
          orderBy: { redeemedAt: 'desc' },
        },
      },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  async redeem(businessId: string, purchaseId: string, data: RedeemPackageDto) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the purchase row
      await tx.$queryRaw`SELECT id FROM "package_purchases" WHERE id = ${purchaseId} AND "businessId" = ${businessId} FOR UPDATE`;

      const purchase = await tx.packagePurchase.findFirst({
        where: { id: purchaseId, businessId },
        include: { package: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');

      if (purchase.status !== 'ACTIVE') {
        throw new BadRequestException(`Cannot redeem: package is ${purchase.status}`);
      }
      if (purchase.expiresAt < new Date()) {
        throw new BadRequestException('Cannot redeem: package has expired');
      }
      if (purchase.usedSessions >= purchase.totalSessions) {
        throw new BadRequestException('Cannot redeem: all sessions used');
      }

      // Verify the booking exists and belongs to this business/customer
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, businessId, customerId: purchase.customerId },
      });
      if (!booking) throw new NotFoundException('Booking not found');

      // Check if booking already has a redemption
      const existingRedemption = await tx.packageRedemption.findUnique({
        where: { bookingId: data.bookingId },
      });
      if (existingRedemption) {
        throw new BadRequestException('This booking already has a package redemption');
      }

      // Validate service match if package is service-specific
      if (purchase.package.serviceId && purchase.package.serviceId !== booking.serviceId) {
        throw new BadRequestException('This package can only be redeemed for the specified service');
      }

      const newUsed = purchase.usedSessions + 1;
      const isExhausted = newUsed >= purchase.totalSessions;

      const [redemption] = await Promise.all([
        tx.packageRedemption.create({
          data: {
            purchaseId,
            bookingId: data.bookingId,
          },
        }),
        tx.packagePurchase.update({
          where: { id: purchaseId },
          data: {
            usedSessions: newUsed,
            ...(isExhausted ? { status: 'EXHAUSTED' } : {}),
          },
        }),
      ]);

      return {
        redemption,
        usedSessions: newUsed,
        totalSessions: purchase.totalSessions,
        remaining: purchase.totalSessions - newUsed,
        status: isExhausted ? 'EXHAUSTED' : 'ACTIVE',
      };
    });
  }

  async unredeemOnCancel(bookingId: string, businessId: string) {
    const redemption = await this.prisma.packageRedemption.findUnique({
      where: { bookingId },
      include: { purchase: true },
    });
    if (!redemption) return null;
    if (redemption.purchase.businessId !== businessId) return null;

    return this.prisma.$transaction(async (tx) => {
      await tx.packageRedemption.delete({ where: { id: redemption.id } });

      const newUsed = Math.max(0, redemption.purchase.usedSessions - 1);
      await tx.packagePurchase.update({
        where: { id: redemption.purchaseId },
        data: {
          usedSessions: newUsed,
          // Reactivate if it was exhausted
          ...(redemption.purchase.status === 'EXHAUSTED' ? { status: 'ACTIVE' } : {}),
        },
      });

      return { unredeemedPurchaseId: redemption.purchaseId, newUsedSessions: newUsed };
    });
  }

  async getCustomerActivePackages(businessId: string, customerId: string, serviceId?: string) {
    const where: any = {
      businessId,
      customerId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    };

    const purchases = await this.prisma.packagePurchase.findMany({
      where,
      include: {
        package: {
          select: { id: true, name: true, serviceId: true, service: { select: { id: true, name: true } } },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    // Filter by service compatibility
    if (serviceId) {
      return purchases.filter(
        (p) => !p.package.serviceId || p.package.serviceId === serviceId,
      );
    }

    return purchases;
  }

  async stats(businessId: string) {
    const [totalPackages, activePurchases, totalRevenue] = await Promise.all([
      this.prisma.servicePackage.count({ where: { businessId } }),
      this.prisma.packagePurchase.count({
        where: { businessId, status: 'ACTIVE' },
      }),
      this.prisma.packagePurchase.findMany({
        where: { businessId },
        include: { package: { select: { price: true } } },
      }),
    ]);

    const revenue = totalRevenue.reduce((sum, p) => sum + Number(p.package.price), 0);
    const totalRedemptions = await this.prisma.packageRedemption.count({
      where: { purchase: { businessId } },
    });

    return {
      totalPackages,
      activePurchases,
      totalRevenue: Math.round(revenue * 100) / 100,
      totalRedemptions,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkExpiredPackages() {
    const now = new Date();
    const expired = await this.prisma.packagePurchase.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      select: { id: true, customerId: true, businessId: true },
    });

    if (expired.length === 0) return;

    await this.prisma.packagePurchase.updateMany({
      where: {
        id: { in: expired.map((p) => p.id) },
      },
      data: { status: 'EXPIRED' },
    });

    this.logger.log(`Expired ${expired.length} package purchases`);
  }
}
