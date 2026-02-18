import { Test } from '@nestjs/testing';
import { SavedViewController } from './saved-view.controller';
import { SavedViewService } from './saved-view.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('SavedViewController', () => {
  let controller: SavedViewController;
  let service: SavedViewService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const mockReq = { user: { sub: 'staff1', businessId: 'biz1', role: 'AGENT' } };
  const mockAdminReq = { user: { sub: 'admin1', businessId: 'biz1', role: 'ADMIN' } };

  const mockView = {
    id: 'sv1',
    businessId: 'biz1',
    staffId: 'staff1',
    page: 'bookings',
    name: 'Pending Only',
    filters: { status: 'PENDING' },
    icon: null,
    color: null,
    isPinned: false,
    isDashboard: false,
    sortOrder: 0,
    isShared: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      controllers: [SavedViewController],
      providers: [SavedViewService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(SavedViewController);
    service = module.get(SavedViewService);
  });

  describe('list', () => {
    it('returns views for a given page', async () => {
      prisma.savedView.findMany.mockResolvedValue([mockView]);

      const result = await controller.list('biz1', mockReq, 'bookings');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pending Only');
    });
  });

  describe('pinned', () => {
    it('returns pinned views', async () => {
      prisma.savedView.findMany.mockResolvedValue([{ ...mockView, isPinned: true }]);

      const result = await controller.pinned('biz1', mockReq);

      expect(result).toHaveLength(1);
    });
  });

  describe('dashboard', () => {
    it('returns dashboard views', async () => {
      prisma.savedView.findMany.mockResolvedValue([{ ...mockView, isDashboard: true }]);

      const result = await controller.dashboard('biz1', mockReq);

      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('creates a new view', async () => {
      prisma.savedView.create.mockResolvedValue(mockView);

      const result = await controller.create('biz1', mockReq, {
        page: 'bookings',
        name: 'Pending Only',
        filters: { status: 'PENDING' },
      });

      expect(result.name).toBe('Pending Only');
    });
  });

  describe('update', () => {
    it('updates a view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue({ ...mockView, name: 'Updated' });

      const result = await controller.update('biz1', mockReq, 'sv1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('deletes a view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.delete.mockResolvedValue(mockView);

      await controller.remove('biz1', mockReq, 'sv1');

      expect(prisma.savedView.delete).toHaveBeenCalledWith({ where: { id: 'sv1' } });
    });
  });

  describe('share', () => {
    it('promotes a view to shared', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue({ ...mockView, isShared: true });

      const result = await controller.share('biz1', 'sv1', { isShared: true });

      expect(result.isShared).toBe(true);
    });
  });
});
