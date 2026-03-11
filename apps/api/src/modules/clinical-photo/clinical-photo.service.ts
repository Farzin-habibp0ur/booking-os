import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { UploadClinicalPhotoDto, CreateComparisonDto } from './dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class ClinicalPhotoService {
  private readonly logger = new Logger(ClinicalPhotoService.name);
  private readonly uploadDir: string;

  constructor(private prisma: PrismaService) {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(
    businessId: string,
    dto: UploadClinicalPhotoDto,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    staffId?: string,
  ) {
    // Validate business is aesthetic vertical
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (!business || business.verticalPack !== 'aesthetic') {
      throw new ForbiddenException('Clinical photos are only available for aesthetic clinics');
    }

    // Validate file
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `Image files must be under 5MB. Received: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    // Validate customer belongs to business
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, businessId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Validate booking if provided
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: dto.bookingId, businessId },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
    }

    // Save file to disk
    const ext = path.extname(file.originalname) || '.jpg';
    const storageKey = `clinical-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, storageKey);
    await fs.promises.writeFile(filePath, file.buffer);

    // Generate thumbnail key (same file for now; real thumbnail generation would use sharp)
    const thumbnailKey = `thumb-${storageKey}`;
    const thumbnailPath = path.join(this.uploadDir, thumbnailKey);
    await fs.promises.writeFile(thumbnailPath, file.buffer);

    const fileUrl = `/api/v1/clinical-photos/file/${storageKey}`;
    const thumbnailUrl = `/api/v1/clinical-photos/file/${thumbnailKey}`;

    return this.prisma.clinicalPhoto.create({
      data: {
        businessId,
        customerId: dto.customerId,
        bookingId: dto.bookingId || null,
        type: dto.type,
        bodyArea: dto.bodyArea,
        fileUrl,
        thumbnailUrl,
        notes: dto.notes || null,
        takenAt: dto.takenAt ? new Date(dto.takenAt) : new Date(),
        takenById: staffId || null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        booking: { select: { id: true, startTime: true, service: { select: { name: true } } } },
        takenBy: { select: { id: true, name: true } },
      },
    });
  }

  async list(
    businessId: string,
    customerId: string,
    filters: { type?: string; bodyArea?: string; from?: string; to?: string } = {},
  ) {
    const where: any = {
      businessId,
      customerId,
      deletedAt: null,
    };

    if (filters.type) where.type = filters.type;
    if (filters.bodyArea) where.bodyArea = filters.bodyArea;
    if (filters.from || filters.to) {
      where.takenAt = {};
      if (filters.from) where.takenAt.gte = new Date(filters.from);
      if (filters.to) where.takenAt.lte = new Date(filters.to);
    }

    return this.prisma.clinicalPhoto.findMany({
      where,
      orderBy: { takenAt: 'desc' },
      include: {
        booking: { select: { id: true, startTime: true, service: { select: { name: true } } } },
        takenBy: { select: { id: true, name: true } },
      },
    });
  }

  async findById(businessId: string, id: string) {
    const photo = await this.prisma.clinicalPhoto.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true } },
        booking: { select: { id: true, startTime: true, service: { select: { name: true } } } },
        takenBy: { select: { id: true, name: true } },
      },
    });
    if (!photo) {
      throw new NotFoundException('Clinical photo not found');
    }
    return photo;
  }

  async softDelete(businessId: string, id: string) {
    const photo = await this.prisma.clinicalPhoto.findFirst({
      where: { id, businessId, deletedAt: null },
    });
    if (!photo) {
      throw new NotFoundException('Clinical photo not found');
    }
    return this.prisma.clinicalPhoto.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createComparison(businessId: string, dto: CreateComparisonDto) {
    // Validate both photos belong to business and customer
    const [beforePhoto, afterPhoto] = await Promise.all([
      this.prisma.clinicalPhoto.findFirst({
        where: { id: dto.beforePhotoId, businessId, deletedAt: null },
      }),
      this.prisma.clinicalPhoto.findFirst({
        where: { id: dto.afterPhotoId, businessId, deletedAt: null },
      }),
    ]);

    if (!beforePhoto) throw new NotFoundException('Before photo not found');
    if (!afterPhoto) throw new NotFoundException('After photo not found');

    if (beforePhoto.customerId !== dto.customerId || afterPhoto.customerId !== dto.customerId) {
      throw new BadRequestException('Both photos must belong to the same customer');
    }

    return this.prisma.photoComparison.create({
      data: {
        businessId,
        customerId: dto.customerId,
        beforePhotoId: dto.beforePhotoId,
        afterPhotoId: dto.afterPhotoId,
        bodyArea: dto.bodyArea,
        notes: dto.notes || null,
      },
      include: {
        beforePhoto: true,
        afterPhoto: true,
      },
    });
  }

  async listComparisons(businessId: string, customerId: string) {
    return this.prisma.photoComparison.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        beforePhoto: true,
        afterPhoto: true,
      },
    });
  }

  async getPhotoCountForCustomer(businessId: string, customerId: string) {
    return this.prisma.clinicalPhoto.count({
      where: { businessId, customerId, deletedAt: null },
    });
  }

  async getBeforePhotosForCustomerBodyArea(
    businessId: string,
    customerId: string,
    bodyArea: string,
  ) {
    return this.prisma.clinicalPhoto.findMany({
      where: {
        businessId,
        customerId,
        bodyArea,
        type: 'BEFORE',
        deletedAt: null,
      },
    });
  }

  getFilePath(storageKey: string): string {
    const filePath = path.join(this.uploadDir, storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }
    return filePath;
  }
}
