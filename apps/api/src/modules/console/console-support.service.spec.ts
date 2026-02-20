import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsoleSupportService } from './console-support.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleSupportService', () => {
  let service: ConsoleSupportService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ConsoleSupportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ConsoleSupportService);
  });

  describe('findAll', () => {
    const mockCase = {
      id: 'case1',
      businessId: 'biz1',
      businessName: 'Glow Clinic',
      subject: 'Login issue',
      description: 'Cannot log in',
      status: 'open',
      priority: 'normal',
      createdAt: new Date(),
      _count: { notes: 2 },
    };

    it('returns paginated results', async () => {
      prisma.supportCase.findMany.mockResolvedValue([mockCase] as any);
      prisma.supportCase.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('filters by status', async () => {
      prisma.supportCase.findMany.mockResolvedValue([mockCase] as any);
      prisma.supportCase.count.mockResolvedValue(1);

      await service.findAll({ status: 'open' });

      expect(prisma.supportCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'open' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns case with notes', async () => {
      const mockCase = {
        id: 'case1',
        businessId: 'biz1',
        businessName: 'Glow Clinic',
        subject: 'Login issue',
        status: 'open',
        notes: [
          { id: 'note1', content: 'Investigating', createdAt: new Date() },
        ],
        business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
      };
      prisma.supportCase.findUnique.mockResolvedValue(mockCase as any);

      const result = await service.findById('case1');

      expect(result.id).toBe('case1');
      expect(result.notes).toHaveLength(1);
      expect(result.business.name).toBe('Glow Clinic');
    });

    it('throws NotFoundException when not found', async () => {
      prisma.supportCase.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates case with business name', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Glow Clinic',
      } as any);
      prisma.supportCase.create.mockResolvedValue({
        id: 'case1',
        businessId: 'biz1',
        businessName: 'Glow Clinic',
        subject: 'Login issue',
        description: 'Cannot log in',
        priority: 'normal',
        createdById: 'admin1',
      } as any);

      const result = await service.create(
        {
          businessId: 'biz1',
          subject: 'Login issue',
          description: 'Cannot log in',
        },
        'admin1',
      );

      expect(result.businessName).toBe('Glow Clinic');
      expect(prisma.supportCase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          businessName: 'Glow Clinic',
          subject: 'Login issue',
          description: 'Cannot log in',
          priority: 'normal',
          createdById: 'admin1',
        }),
      });
    });

    it('throws NotFoundException for invalid business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            businessId: 'nonexistent',
            subject: 'Test',
            description: 'Test',
          },
          'admin1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('changes status', async () => {
      prisma.supportCase.findUnique.mockResolvedValue({
        id: 'case1',
        status: 'open',
        resolvedAt: null,
        closedAt: null,
      } as any);
      prisma.supportCase.update.mockResolvedValue({
        id: 'case1',
        status: 'in_progress',
      } as any);

      const result = await service.update('case1', { status: 'in_progress' });

      expect(result.status).toBe('in_progress');
      expect(prisma.supportCase.update).toHaveBeenCalledWith({
        where: { id: 'case1' },
        data: expect.objectContaining({ status: 'in_progress' }),
      });
    });

    it('sets resolvedAt when resolving', async () => {
      prisma.supportCase.findUnique.mockResolvedValue({
        id: 'case1',
        status: 'in_progress',
        resolvedAt: null,
        closedAt: null,
      } as any);
      prisma.supportCase.update.mockResolvedValue({
        id: 'case1',
        status: 'resolved',
        resolvedAt: new Date(),
      } as any);

      await service.update('case1', { status: 'resolved' });

      expect(prisma.supportCase.update).toHaveBeenCalledWith({
        where: { id: 'case1' },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('addNote', () => {
    it('creates note', async () => {
      prisma.supportCase.findUnique.mockResolvedValue({
        id: 'case1',
        status: 'open',
      } as any);
      prisma.supportCaseNote.create.mockResolvedValue({
        id: 'note1',
        caseId: 'case1',
        authorId: 'admin1',
        authorName: 'Admin',
        content: 'Looking into it',
      } as any);

      const result = await service.addNote(
        'case1',
        { content: 'Looking into it' },
        'admin1',
        'Admin',
      );

      expect(result.content).toBe('Looking into it');
      expect(prisma.supportCaseNote.create).toHaveBeenCalledWith({
        data: {
          caseId: 'case1',
          authorId: 'admin1',
          authorName: 'Admin',
          content: 'Looking into it',
        },
      });
    });

    it('throws NotFoundException for invalid case', async () => {
      prisma.supportCase.findUnique.mockResolvedValue(null);

      await expect(
        service.addNote('nonexistent', { content: 'Test' }, 'admin1', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
