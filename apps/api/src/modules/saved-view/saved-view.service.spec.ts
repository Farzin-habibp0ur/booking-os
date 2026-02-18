import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SavedViewService } from './saved-view.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('SavedViewService', () => {
  let service: SavedViewService;
  let prisma: ReturnType<typeof createMockPrisma>;

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
      providers: [SavedViewService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SavedViewService);
  });

  describe('findByPage', () => {
    it('returns views for the given page (personal + shared)', async () => {
      prisma.savedView.findMany.mockResolvedValue([mockView]);

      const result = await service.findByPage('biz1', 'staff1', 'bookings');

      expect(result).toHaveLength(1);
      expect(prisma.savedView.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz1',
          page: 'bookings',
          OR: [{ staffId: 'staff1' }, { isShared: true }],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('returns empty array when no views exist', async () => {
      prisma.savedView.findMany.mockResolvedValue([]);

      const result = await service.findByPage('biz1', 'staff1', 'inbox');

      expect(result).toEqual([]);
    });
  });

  describe('findPinned', () => {
    it('returns only pinned views', async () => {
      const pinned = { ...mockView, isPinned: true };
      prisma.savedView.findMany.mockResolvedValue([pinned]);

      const result = await service.findPinned('biz1', 'staff1');

      expect(result).toHaveLength(1);
      expect(prisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPinned: true }),
        }),
      );
    });
  });

  describe('findDashboard', () => {
    it('returns only dashboard-pinned views', async () => {
      const dashView = { ...mockView, isDashboard: true };
      prisma.savedView.findMany.mockResolvedValue([dashView]);

      const result = await service.findDashboard('biz1', 'staff1');

      expect(result).toHaveLength(1);
      expect(prisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDashboard: true }),
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a saved view', async () => {
      prisma.savedView.create.mockResolvedValue(mockView);

      const result = await service.create('biz1', 'staff1', {
        page: 'bookings',
        name: 'Pending Only',
        filters: { status: 'PENDING' },
      });

      expect(result.name).toBe('Pending Only');
      expect(prisma.savedView.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          staffId: 'staff1',
          page: 'bookings',
          name: 'Pending Only',
        }),
      });
    });

    it('creates a view with icon and color', async () => {
      const viewWithStyle = { ...mockView, icon: 'star', color: 'sage' };
      prisma.savedView.create.mockResolvedValue(viewWithStyle);

      const result = await service.create('biz1', 'staff1', {
        page: 'bookings',
        name: 'VIP Bookings',
        filters: { status: 'CONFIRMED' },
        icon: 'star',
        color: 'sage',
      });

      expect(prisma.savedView.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ icon: 'star', color: 'sage' }),
      });
    });
  });

  describe('update', () => {
    it('allows owner to update their view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue({ ...mockView, name: 'Updated' });

      const result = await service.update('sv1', 'biz1', 'staff1', 'AGENT', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('allows admin to update any view', async () => {
      prisma.savedView.findFirst.mockResolvedValue({ ...mockView, staffId: 'other-staff' });
      prisma.savedView.update.mockResolvedValue({ ...mockView, name: 'Admin Updated' });

      const result = await service.update('sv1', 'biz1', 'admin1', 'ADMIN', {
        name: 'Admin Updated',
      });

      expect(result.name).toBe('Admin Updated');
    });

    it('throws ForbiddenException when non-owner non-admin tries to update', async () => {
      prisma.savedView.findFirst.mockResolvedValue({ ...mockView, staffId: 'other-staff' });

      await expect(
        service.update('sv1', 'biz1', 'staff1', 'AGENT', { name: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'biz1', 'staff1', 'AGENT', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates pin status', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue({ ...mockView, isPinned: true });

      const result = await service.update('sv1', 'biz1', 'staff1', 'AGENT', {
        isPinned: true,
      });

      expect(result.isPinned).toBe(true);
    });

    it('updates dashboard status', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue({ ...mockView, isDashboard: true });

      const result = await service.update('sv1', 'biz1', 'staff1', 'AGENT', {
        isDashboard: true,
      });

      expect(result.isDashboard).toBe(true);
    });
  });

  describe('remove', () => {
    it('allows owner to delete their view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.delete.mockResolvedValue(mockView);

      const result = await service.remove('sv1', 'biz1', 'staff1', 'AGENT');

      expect(prisma.savedView.delete).toHaveBeenCalledWith({ where: { id: 'sv1' } });
    });

    it('allows admin to delete any view', async () => {
      prisma.savedView.findFirst.mockResolvedValue({ ...mockView, staffId: 'other-staff' });
      prisma.savedView.delete.mockResolvedValue(mockView);

      await service.remove('sv1', 'biz1', 'admin1', 'ADMIN');

      expect(prisma.savedView.delete).toHaveBeenCalled();
    });

    it('throws ForbiddenException when non-owner non-admin tries to delete', async () => {
      prisma.savedView.findFirst.mockResolvedValue({ ...mockView, staffId: 'other-staff' });

      await expect(
        service.remove('sv1', 'biz1', 'staff1', 'AGENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', 'biz1', 'staff1', 'AGENT'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('share', () => {
    it('promotes a view to shared', async () => {
      prisma.savedView.findFirst.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue({ ...mockView, isShared: true });

      const result = await service.share('sv1', 'biz1', true);

      expect(result.isShared).toBe(true);
      expect(prisma.savedView.update).toHaveBeenCalledWith({
        where: { id: 'sv1' },
        data: { isShared: true },
      });
    });

    it('demotes a shared view', async () => {
      prisma.savedView.findFirst.mockResolvedValue({ ...mockView, isShared: true });
      prisma.savedView.update.mockResolvedValue({ ...mockView, isShared: false });

      const result = await service.share('sv1', 'biz1', false);

      expect(result.isShared).toBe(false);
    });

    it('throws NotFoundException for non-existent view', async () => {
      prisma.savedView.findFirst.mockResolvedValue(null);

      await expect(service.share('nonexistent', 'biz1', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
