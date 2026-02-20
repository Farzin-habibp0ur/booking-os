import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PACK_SKILLS } from '../agent-skills/agent-skills.service';

@Injectable()
export class ConsolePacksService {
  private readonly logger = new Logger(ConsolePacksService.name);

  constructor(private prisma: PrismaService) {}

  async getRegistry() {
    const [allVersions, totalBusinesses] = await Promise.all([
      this.prisma.verticalPackVersion.findMany({
        where: { businessId: null },
        orderBy: [{ slug: 'asc' }, { version: 'desc' }],
      }),
      this.prisma.business.count(),
    ]);

    const packMap = new Map<
      string,
      { latest: (typeof allVersions)[0]; versions: (typeof allVersions)[0][] }
    >();

    for (const v of allVersions) {
      const existing = packMap.get(v.slug);
      if (existing) {
        existing.versions.push(v);
      } else {
        packMap.set(v.slug, { latest: v, versions: [v] });
      }
    }

    const packs = await Promise.all(
      Array.from(packMap.entries()).map(async ([slug, { latest, versions }]) => {
        const businessCount = await this.prisma.business.count({
          where: { verticalPack: slug },
        });

        const skills = PACK_SKILLS[slug] || [];

        return {
          slug,
          name: latest.name,
          description: latest.description,
          latestVersion: latest.version,
          rolloutStage: latest.rolloutStage,
          rolloutPercent: latest.rolloutPercent,
          isPublished: latest.isPublished,
          businessCount,
          totalBusinesses,
          adoptionPercent:
            totalBusinesses > 0
              ? Math.round((businessCount / totalBusinesses) * 100)
              : 0,
          skillCount: skills.length,
          versionCount: versions.length,
        };
      }),
    );

    return packs;
  }

  async getPackDetail(slug: string) {
    const versions = await this.prisma.verticalPackVersion.findMany({
      where: { slug, businessId: null },
      orderBy: { version: 'desc' },
    });

    if (versions.length === 0) {
      throw new NotFoundException(`Pack "${slug}" not found`);
    }

    const [businessCount, totalBusinesses, pinnedCount] = await Promise.all([
      this.prisma.business.count({ where: { verticalPack: slug } }),
      this.prisma.business.count(),
      this.prisma.packTenantPin.count({ where: { packSlug: slug } }),
    ]);

    return {
      slug,
      name: versions[0].name,
      description: versions[0].description,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        isPublished: v.isPublished,
        rolloutStage: v.rolloutStage,
        rolloutPercent: v.rolloutPercent,
        rolloutStartedAt: v.rolloutStartedAt,
        rolloutCompletedAt: v.rolloutCompletedAt,
        rolloutPausedAt: v.rolloutPausedAt,
        rolledBackAt: v.rolledBackAt,
        rolledBackReason: v.rolledBackReason,
        config: v.config,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      businessCount,
      totalBusinesses,
      adoptionPercent:
        totalBusinesses > 0
          ? Math.round((businessCount / totalBusinesses) * 100)
          : 0,
      pinnedCount,
    };
  }

  async getVersions(slug: string) {
    const versions = await this.prisma.verticalPackVersion.findMany({
      where: { slug, businessId: null },
      orderBy: { version: 'desc' },
    });

    if (versions.length === 0) {
      throw new NotFoundException(`Pack "${slug}" not found`);
    }

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      name: v.name,
      isPublished: v.isPublished,
      rolloutStage: v.rolloutStage,
      rolloutPercent: v.rolloutPercent,
      rolloutStartedAt: v.rolloutStartedAt,
      rolloutCompletedAt: v.rolloutCompletedAt,
      rolledBackAt: v.rolledBackAt,
      rolledBackReason: v.rolledBackReason,
      createdAt: v.createdAt,
    }));
  }

  async startOrAdvanceRollout(slug: string, version: number, targetPercent: number) {
    const packVersion = await this.prisma.verticalPackVersion.findUnique({
      where: { slug_version: { slug, version } },
    });

    if (!packVersion) {
      throw new NotFoundException(`Pack "${slug}" v${version} not found`);
    }

    if (packVersion.rolloutStage === 'draft') {
      throw new BadRequestException('Pack must be published before starting rollout');
    }

    if (packVersion.rolloutStage === 'completed') {
      throw new BadRequestException('Rollout already completed');
    }

    if (packVersion.rolloutStage === 'rolled_back') {
      throw new BadRequestException('Cannot advance a rolled-back version');
    }

    if (packVersion.rolloutStage === 'paused') {
      throw new BadRequestException('Rollout is paused — resume before advancing');
    }

    if (targetPercent <= packVersion.rolloutPercent) {
      throw new BadRequestException(
        `Target percent (${targetPercent}%) must be greater than current (${packVersion.rolloutPercent}%)`,
      );
    }

    const now = new Date();
    const isCompleting = targetPercent === 100;

    const updated = await this.prisma.verticalPackVersion.update({
      where: { id: packVersion.id },
      data: {
        rolloutStage: isCompleting ? 'completed' : 'rolling_out',
        rolloutPercent: targetPercent,
        rolloutStartedAt: packVersion.rolloutStartedAt || now,
        ...(isCompleting && { rolloutCompletedAt: now }),
      },
    });

    this.logger.log(
      `Rollout ${slug} v${version}: ${packVersion.rolloutPercent}% → ${targetPercent}%`,
    );

    return {
      id: updated.id,
      slug: updated.slug,
      version: updated.version,
      rolloutStage: updated.rolloutStage,
      rolloutPercent: updated.rolloutPercent,
      rolloutStartedAt: updated.rolloutStartedAt,
      rolloutCompletedAt: updated.rolloutCompletedAt,
    };
  }

  async pauseRollout(slug: string, version: number) {
    const packVersion = await this.prisma.verticalPackVersion.findUnique({
      where: { slug_version: { slug, version } },
    });

    if (!packVersion) {
      throw new NotFoundException(`Pack "${slug}" v${version} not found`);
    }

    if (packVersion.rolloutStage !== 'rolling_out') {
      throw new BadRequestException(
        `Cannot pause rollout in "${packVersion.rolloutStage}" stage`,
      );
    }

    const updated = await this.prisma.verticalPackVersion.update({
      where: { id: packVersion.id },
      data: {
        rolloutStage: 'paused',
        rolloutPausedAt: new Date(),
      },
    });

    this.logger.log(`Paused rollout ${slug} v${version} at ${updated.rolloutPercent}%`);

    return {
      id: updated.id,
      slug: updated.slug,
      version: updated.version,
      rolloutStage: updated.rolloutStage,
      rolloutPercent: updated.rolloutPercent,
      rolloutPausedAt: updated.rolloutPausedAt,
    };
  }

  async resumeRollout(slug: string, version: number) {
    const packVersion = await this.prisma.verticalPackVersion.findUnique({
      where: { slug_version: { slug, version } },
    });

    if (!packVersion) {
      throw new NotFoundException(`Pack "${slug}" v${version} not found`);
    }

    if (packVersion.rolloutStage !== 'paused') {
      throw new BadRequestException(
        `Cannot resume rollout in "${packVersion.rolloutStage}" stage`,
      );
    }

    const updated = await this.prisma.verticalPackVersion.update({
      where: { id: packVersion.id },
      data: {
        rolloutStage: 'rolling_out',
        rolloutPausedAt: null,
      },
    });

    this.logger.log(`Resumed rollout ${slug} v${version} at ${updated.rolloutPercent}%`);

    return {
      id: updated.id,
      slug: updated.slug,
      version: updated.version,
      rolloutStage: updated.rolloutStage,
      rolloutPercent: updated.rolloutPercent,
    };
  }

  async rollbackVersion(slug: string, version: number, reason: string) {
    const packVersion = await this.prisma.verticalPackVersion.findUnique({
      where: { slug_version: { slug, version } },
    });

    if (!packVersion) {
      throw new NotFoundException(`Pack "${slug}" v${version} not found`);
    }

    const rollbackable = ['rolling_out', 'paused', 'completed'];
    if (!rollbackable.includes(packVersion.rolloutStage)) {
      throw new BadRequestException(
        `Cannot rollback from "${packVersion.rolloutStage}" stage`,
      );
    }

    const updated = await this.prisma.verticalPackVersion.update({
      where: { id: packVersion.id },
      data: {
        rolloutStage: 'rolled_back',
        rolledBackAt: new Date(),
        rolledBackReason: reason,
      },
    });

    this.logger.warn(`Rolled back ${slug} v${version}: ${reason}`);

    return {
      id: updated.id,
      slug: updated.slug,
      version: updated.version,
      rolloutStage: updated.rolloutStage,
      rolledBackAt: updated.rolledBackAt,
      rolledBackReason: updated.rolledBackReason,
    };
  }

  async getPins(slug: string) {
    const pins = await this.prisma.packTenantPin.findMany({
      where: { packSlug: slug },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        pinnedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pins.map((p) => ({
      id: p.id,
      businessId: p.businessId,
      businessName: p.business.name,
      businessSlug: p.business.slug,
      packSlug: p.packSlug,
      pinnedVersion: p.pinnedVersion,
      reason: p.reason,
      pinnedBy: { id: p.pinnedBy.id, name: p.pinnedBy.name, email: p.pinnedBy.email },
      createdAt: p.createdAt,
    }));
  }

  async pinBusiness(
    slug: string,
    businessId: string,
    pinnedVersion: number,
    reason: string,
    actorId: string,
  ) {
    const [business, packVersion] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId } }),
      this.prisma.verticalPackVersion.findUnique({
        where: { slug_version: { slug, version: pinnedVersion } },
      }),
    ]);

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (!packVersion) {
      throw new NotFoundException(`Pack "${slug}" v${pinnedVersion} not found`);
    }

    const pin = await this.prisma.packTenantPin.upsert({
      where: { businessId_packSlug: { businessId, packSlug: slug } },
      create: {
        businessId,
        packSlug: slug,
        pinnedVersion,
        reason,
        pinnedById: actorId,
      },
      update: {
        pinnedVersion,
        reason,
        pinnedById: actorId,
      },
    });

    this.logger.log(`Pinned ${businessId} to ${slug} v${pinnedVersion}`);

    return pin;
  }

  async unpinBusiness(slug: string, businessId: string) {
    const pin = await this.prisma.packTenantPin.findUnique({
      where: { businessId_packSlug: { businessId, packSlug: slug } },
    });

    if (!pin) {
      throw new NotFoundException('Pin not found');
    }

    await this.prisma.packTenantPin.delete({ where: { id: pin.id } });

    this.logger.log(`Unpinned ${businessId} from ${slug}`);

    return { success: true };
  }
}
