import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@booking-os/db';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PackBuilderService {
  private readonly logger = new Logger(PackBuilderService.name);

  constructor(private prisma: PrismaService) {}

  /** List all pack versions (latest version per slug by default) */
  async listPacks(includeAllVersions = false) {
    if (includeAllVersions) {
      return this.prisma.verticalPackVersion.findMany({
        orderBy: [{ slug: 'asc' }, { version: 'desc' }],
      });
    }

    // Get latest version of each slug
    const allPacks = await this.prisma.verticalPackVersion.findMany({
      orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    });

    const latestBySlug = new Map<string, (typeof allPacks)[0]>();
    for (const pack of allPacks) {
      if (!latestBySlug.has(pack.slug)) {
        latestBySlug.set(pack.slug, pack);
      }
    }
    return Array.from(latestBySlug.values());
  }

  /** Get the latest version of a pack by slug */
  async getPackBySlug(slug: string) {
    const pack = await this.prisma.verticalPackVersion.findFirst({
      where: { slug },
      orderBy: { version: 'desc' },
    });
    if (!pack) throw new NotFoundException(`Pack "${slug}" not found`);
    return pack;
  }

  /** Get a specific pack by ID */
  async getPackById(id: string) {
    const pack = await this.prisma.verticalPackVersion.findUnique({
      where: { id },
    });
    if (!pack) throw new NotFoundException('Pack version not found');
    return pack;
  }

  /** List all versions of a pack by slug */
  async getPackVersions(slug: string) {
    const versions = await this.prisma.verticalPackVersion.findMany({
      where: { slug },
      orderBy: { version: 'desc' },
    });
    if (versions.length === 0) {
      throw new NotFoundException(`Pack "${slug}" not found`);
    }
    return versions;
  }

  /** Create a new pack (version 1, unpublished draft) */
  async createPack(data: {
    slug: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) {
    // Check if slug already exists
    const existing = await this.prisma.verticalPackVersion.findFirst({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new BadRequestException(`Pack with slug "${data.slug}" already exists`);
    }

    const defaultConfig = {
      labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
      intakeFields: [],
      defaultServices: [],
      defaultTemplates: [],
      defaultAutomations: [],
      kanbanEnabled: false,
      kanbanStatuses: [],
    };

    return this.prisma.verticalPackVersion.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        config: (data.config || defaultConfig) as Prisma.InputJsonValue,
        version: 1,
        isPublished: false,
      },
    });
  }

  /** Update a draft pack (cannot update published packs) */
  async updatePack(
    id: string,
    data: {
      name?: string;
      description?: string;
      config?: Record<string, unknown>;
    },
  ) {
    const pack = await this.getPackById(id);
    if (pack.isPublished) {
      throw new BadRequestException(
        'Cannot update a published pack version. Create a new version instead.',
      );
    }

    const updateData: Prisma.VerticalPackVersionUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.config !== undefined && { config: data.config as Prisma.InputJsonValue }),
    };

    return this.prisma.verticalPackVersion.update({
      where: { id },
      data: updateData,
    });
  }

  /** Publish a pack version — marks it as published and creates a new draft for future edits */
  async publishPack(id: string) {
    const pack = await this.getPackById(id);
    if (pack.isPublished) {
      throw new BadRequestException('This pack version is already published');
    }

    // Publish the current version
    const published = await this.prisma.verticalPackVersion.update({
      where: { id },
      data: { isPublished: true },
    });

    this.logger.log(`Published pack "${pack.slug}" v${pack.version}`);
    return published;
  }

  /** Create a new draft version from the latest published version */
  async createNewVersion(slug: string) {
    const latest = await this.getPackBySlug(slug);

    // Check if there's already an unpublished draft
    const existingDraft = await this.prisma.verticalPackVersion.findFirst({
      where: { slug, isPublished: false },
      orderBy: { version: 'desc' },
    });
    if (existingDraft) {
      throw new BadRequestException(
        `An unpublished draft (v${existingDraft.version}) already exists for "${slug}". Update or publish it first.`,
      );
    }

    return this.prisma.verticalPackVersion.create({
      data: {
        slug,
        name: latest.name,
        description: latest.description,
        config: latest.config as Prisma.InputJsonValue,
        version: latest.version + 1,
        isPublished: false,
      },
    });
  }

  /** Delete an unpublished draft (cannot delete published versions) */
  async deletePack(id: string) {
    const pack = await this.getPackById(id);
    if (pack.isPublished) {
      throw new BadRequestException('Cannot delete a published pack version');
    }

    return this.prisma.verticalPackVersion.delete({ where: { id } });
  }
}
