import { Test } from '@nestjs/testing';
import { PlatformAuditService } from './platform-audit.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('PlatformAuditService', () => {
  let service: PlatformAuditService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [PlatformAuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PlatformAuditService);
  });

  it('creates audit log entry', async () => {
    prisma.platformAuditLog.create.mockResolvedValue({ id: 'log1' } as any);

    await service.log('admin1', 'admin@test.com', 'BUSINESS_LOOKUP', {
      targetType: 'BUSINESS',
      targetId: 'biz1',
    });

    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin1',
        actorEmail: 'admin@test.com',
        action: 'BUSINESS_LOOKUP',
        targetType: 'BUSINESS',
        targetId: 'biz1',
      }),
    });
  });

  it('does not throw on failure', async () => {
    prisma.platformAuditLog.create.mockRejectedValue(new Error('DB error'));

    await expect(service.log('admin1', 'admin@test.com', 'BUSINESS_LOOKUP')).resolves.not.toThrow();
  });

  it('logs with metadata', async () => {
    prisma.platformAuditLog.create.mockResolvedValue({ id: 'log1' } as any);

    await service.log('admin1', 'admin@test.com', 'VIEW_AS_START', {
      targetType: 'BUSINESS',
      targetId: 'biz1',
      reason: 'Testing view-as',
      metadata: { sessionId: 'sess1' },
    });

    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'Testing view-as',
        metadata: { sessionId: 'sess1' },
      }),
    });
  });
});
