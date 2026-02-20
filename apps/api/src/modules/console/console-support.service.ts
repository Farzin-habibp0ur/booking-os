import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

interface SupportCaseQuery {
  search?: string;
  status?: string;
  priority?: string;
  businessId?: string;
  page?: number;
  pageSize?: number;
}

interface CreateSupportCaseDto {
  businessId: string;
  subject: string;
  description: string;
  priority?: string;
  category?: string;
}

interface UpdateSupportCaseDto {
  status?: string;
  priority?: string;
  resolution?: string;
}

interface AddNoteDto {
  content: string;
}

@Injectable()
export class ConsoleSupportService {
  private readonly logger = new Logger(ConsoleSupportService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query: SupportCaseQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { businessName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.businessId) where.businessId = query.businessId;

    const [items, total] = await Promise.all([
      this.prisma.supportCase.findMany({
        where,
        include: {
          _count: { select: { notes: true } },
        },
        orderBy: [
          { status: 'asc' }, // open first
          { createdAt: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.supportCase.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string) {
    const supportCase = await this.prisma.supportCase.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!supportCase) throw new NotFoundException('Support case not found');
    return supportCase;
  }

  async create(dto: CreateSupportCaseDto, actorId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: dto.businessId },
      select: { id: true, name: true },
    });

    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.supportCase.create({
      data: {
        businessId: dto.businessId,
        businessName: business.name,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority || 'normal',
        category: dto.category || null,
        createdById: actorId,
      },
    });
  }

  async update(id: string, dto: UpdateSupportCaseDto) {
    const existing = await this.prisma.supportCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Support case not found');

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.priority) data.priority = dto.priority;
    if (dto.resolution !== undefined) data.resolution = dto.resolution;

    if (dto.status === 'resolved' && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }
    if (dto.status === 'closed' && !existing.closedAt) {
      data.closedAt = new Date();
    }

    return this.prisma.supportCase.update({ where: { id }, data });
  }

  async addNote(caseId: string, dto: AddNoteDto, authorId: string, authorName: string) {
    const supportCase = await this.prisma.supportCase.findUnique({ where: { id: caseId } });
    if (!supportCase) throw new NotFoundException('Support case not found');

    return this.prisma.supportCaseNote.create({
      data: {
        caseId,
        authorId,
        authorName,
        content: dto.content,
      },
    });
  }
}
