import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../common/prisma.service';
import {
  createMockPrisma,
  createMockTokenService,
  createMockEmailService,
  createMockConfigService,
} from '../../test/mocks';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

describe('StaffService - preferences', () => {
  let service: StaffService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: createMockTokenService() },
        { provide: EmailService, useValue: createMockEmailService() },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    service = module.get(StaffService);
  });

  describe('updatePreferences', () => {
    it('merges new preferences with existing ones', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 'staff1',
        preferences: { mode: 'admin' },
      } as any);
      prisma.staff.update.mockResolvedValue({
        id: 'staff1',
        preferences: { mode: 'admin', landingPath: '/inbox' },
      } as any);

      const result = await service.updatePreferences('staff1', { landingPath: '/inbox' });

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { preferences: { mode: 'admin', landingPath: '/inbox' } },
        select: { id: true, preferences: true },
      });
    });

    it('handles staff with empty preferences', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 'staff1',
        preferences: {},
      } as any);
      prisma.staff.update.mockResolvedValue({
        id: 'staff1',
        preferences: { mode: 'agent' },
      } as any);

      await service.updatePreferences('staff1', { mode: 'agent' });

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { preferences: { mode: 'agent' } },
        select: { id: true, preferences: true },
      });
    });

    it('overwrites existing preference keys', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 'staff1',
        preferences: { mode: 'admin', landingPath: '/dashboard' },
      } as any);
      prisma.staff.update.mockResolvedValue({
        id: 'staff1',
        preferences: { mode: 'agent', landingPath: '/dashboard' },
      } as any);

      await service.updatePreferences('staff1', { mode: 'agent' });

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { preferences: { mode: 'agent', landingPath: '/dashboard' } },
        select: { id: true, preferences: true },
      });
    });

    it('handles null staff preferences gracefully', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 'staff1',
        preferences: null,
      } as any);
      prisma.staff.update.mockResolvedValue({
        id: 'staff1',
        preferences: { mode: 'provider' },
      } as any);

      await service.updatePreferences('staff1', { mode: 'provider' });

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { preferences: { mode: 'provider' } },
        select: { id: true, preferences: true },
      });
    });
  });
});
