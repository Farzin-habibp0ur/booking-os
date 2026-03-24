import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenService } from './device-token.service';
import { PrismaService } from '../../common/prisma.service';

describe('DeviceTokenService', () => {
  let service: DeviceTokenService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      deviceToken: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceTokenService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DeviceTokenService);
  });

  describe('register', () => {
    it('should upsert a device token', async () => {
      prisma.deviceToken.upsert.mockResolvedValue({ id: 'dt-1', staffId: 's1', token: 'abc' });

      const result = await service.register('s1', 'b1', 'abc', 'ios');

      expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
        where: { staffId_token: { staffId: 's1', token: 'abc' } },
        create: { staffId: 's1', businessId: 'b1', token: 'abc', platform: 'ios', isActive: true },
        update: expect.objectContaining({ isActive: true, platform: 'ios' }),
      });
      expect(result.id).toBe('dt-1');
    });
  });

  describe('unregister', () => {
    it('should deactivate token', async () => {
      prisma.deviceToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.unregister('abc');

      expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'abc' },
        data: { isActive: false },
      });
      expect(result.count).toBe(1);
    });
  });

  describe('findActiveByStaff', () => {
    it('should return active tokens for a staff member', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dt-1', token: 'abc', platform: 'ios' },
      ]);

      const result = await service.findActiveByStaff('s1');

      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { staffId: 's1', isActive: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findActiveByBusiness', () => {
    it('should return all active tokens for a business', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dt-1' },
        { id: 'dt-2' },
      ]);

      const result = await service.findActiveByBusiness('b1');

      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { businessId: 'b1', isActive: true },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('deactivateStale', () => {
    it('should deactivate tokens not updated in 90 days', async () => {
      prisma.deviceToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.deactivateStale();

      expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
        where: { isActive: true, updatedAt: { lt: expect.any(Date) } },
        data: { isActive: false },
      });
      expect(result.count).toBe(3);
    });
  });
});
