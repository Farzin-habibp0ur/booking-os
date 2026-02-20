import { Test } from '@nestjs/testing';
import { ConsolePacksController } from './console-packs.controller';
import { ConsolePacksService } from './console-packs.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsolePacksController', () => {
  let controller: ConsolePacksController;
  let service: jest.Mocked<ConsolePacksService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockService = {
      getRegistry: jest.fn(),
      getPackDetail: jest.fn(),
      getVersions: jest.fn(),
      startOrAdvanceRollout: jest.fn(),
      pauseRollout: jest.fn(),
      resumeRollout: jest.fn(),
      rollbackVersion: jest.fn(),
      getPins: jest.fn(),
      pinBusiness: jest.fn(),
      unpinBusiness: jest.fn(),
    };

    const mockAuditService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [ConsolePacksController],
      providers: [
        { provide: ConsolePacksService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsolePacksController);
    service = module.get(ConsolePacksService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('GET /registry delegates to service', async () => {
    const registryData = [{ slug: 'aesthetic', name: 'Aesthetic' }];
    service.getRegistry.mockResolvedValue(registryData as any);

    const result = await controller.getRegistry(mockUser);

    expect(service.getRegistry).toHaveBeenCalled();
    expect(result).toEqual(registryData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_REGISTRY_VIEW',
    );
  });

  it('GET /:slug/detail delegates to service', async () => {
    const detailData = { slug: 'aesthetic', name: 'Aesthetic', versions: [] };
    service.getPackDetail.mockResolvedValue(detailData as any);

    const result = await controller.getPackDetail('aesthetic', mockUser);

    expect(service.getPackDetail).toHaveBeenCalledWith('aesthetic');
    expect(result).toEqual(detailData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_DETAIL_VIEW',
      expect.objectContaining({ targetType: 'PACK', targetId: 'aesthetic' }),
    );
  });

  it('GET /:slug/versions delegates to service', async () => {
    const versionsData = [{ version: 1, rolloutStage: 'published' }];
    service.getVersions.mockResolvedValue(versionsData as any);

    const result = await controller.getVersions('aesthetic', mockUser);

    expect(service.getVersions).toHaveBeenCalledWith('aesthetic');
    expect(result).toEqual(versionsData);
  });

  it('POST /:slug/versions/:version/rollout delegates with targetPercent', async () => {
    const rolloutData = { rolloutStage: 'rolling_out', rolloutPercent: 5 };
    service.startOrAdvanceRollout.mockResolvedValue(rolloutData as any);

    const result = await controller.startOrAdvanceRollout(
      'aesthetic', 2, { targetPercent: 5 } as any, mockUser,
    );

    expect(service.startOrAdvanceRollout).toHaveBeenCalledWith('aesthetic', 2, 5);
    expect(result).toEqual(rolloutData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_ROLLOUT_ADVANCE',
      expect.objectContaining({
        targetType: 'PACK_VERSION',
        targetId: 'aesthetic/v2',
        metadata: { targetPercent: 5 },
      }),
    );
  });

  it('POST /:slug/versions/:version/pause delegates to service', async () => {
    const pauseData = { rolloutStage: 'paused', rolloutPercent: 25 };
    service.pauseRollout.mockResolvedValue(pauseData as any);

    const result = await controller.pauseRollout('aesthetic', 2, mockUser);

    expect(service.pauseRollout).toHaveBeenCalledWith('aesthetic', 2);
    expect(result).toEqual(pauseData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_ROLLOUT_PAUSE',
      expect.objectContaining({ targetType: 'PACK_VERSION' }),
    );
  });

  it('POST /:slug/versions/:version/resume delegates to service', async () => {
    const resumeData = { rolloutStage: 'rolling_out', rolloutPercent: 25 };
    service.resumeRollout.mockResolvedValue(resumeData as any);

    const result = await controller.resumeRollout('aesthetic', 2, mockUser);

    expect(service.resumeRollout).toHaveBeenCalledWith('aesthetic', 2);
    expect(result).toEqual(resumeData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_ROLLOUT_RESUME',
      expect.objectContaining({ targetType: 'PACK_VERSION' }),
    );
  });

  it('POST /:slug/versions/:version/rollback delegates with reason', async () => {
    const rollbackData = { rolloutStage: 'rolled_back', rolledBackReason: 'Bug found' };
    service.rollbackVersion.mockResolvedValue(rollbackData as any);

    const result = await controller.rollbackVersion(
      'aesthetic', 2, { reason: 'Bug found' }, mockUser,
    );

    expect(service.rollbackVersion).toHaveBeenCalledWith('aesthetic', 2, 'Bug found');
    expect(result).toEqual(rollbackData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_ROLLOUT_ROLLBACK',
      expect.objectContaining({ reason: 'Bug found' }),
    );
  });

  it('GET /:slug/pins delegates to service', async () => {
    const pinsData = [{ id: 'pin1', businessName: 'Glow Clinic' }];
    service.getPins.mockResolvedValue(pinsData as any);

    const result = await controller.getPins('aesthetic', mockUser);

    expect(service.getPins).toHaveBeenCalledWith('aesthetic');
    expect(result).toEqual(pinsData);
  });

  it('POST /:slug/pins delegates with body and audit logs', async () => {
    const pinData = { id: 'pin1', businessId: 'biz1', pinnedVersion: 1 };
    service.pinBusiness.mockResolvedValue(pinData as any);

    const result = await controller.pinBusiness(
      'aesthetic',
      { businessId: 'biz1', pinnedVersion: 1, reason: 'Legacy' },
      mockUser,
    );

    expect(service.pinBusiness).toHaveBeenCalledWith('aesthetic', 'biz1', 1, 'Legacy', 'admin1');
    expect(result).toEqual(pinData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_TENANT_PIN',
      expect.objectContaining({
        targetType: 'BUSINESS',
        targetId: 'biz1',
        reason: 'Legacy',
      }),
    );
  });

  it('DELETE /:slug/pins/:businessId delegates and audit logs', async () => {
    service.unpinBusiness.mockResolvedValue({ success: true });

    const result = await controller.unpinBusiness('aesthetic', 'biz1', mockUser);

    expect(service.unpinBusiness).toHaveBeenCalledWith('aesthetic', 'biz1');
    expect(result).toEqual({ success: true });
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'PACK_TENANT_UNPIN',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
  });
});
