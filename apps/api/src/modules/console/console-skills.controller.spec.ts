import { Test } from '@nestjs/testing';
import { ConsoleSkillsController } from './console-skills.controller';
import { ConsoleSkillsService } from './console-skills.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleSkillsController', () => {
  let controller: ConsoleSkillsController;
  let service: jest.Mocked<ConsoleSkillsService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockService = {
      getCatalog: jest.fn(),
      getSkillAdoption: jest.fn(),
      platformOverride: jest.fn(),
    };

    const mockAuditService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [ConsoleSkillsController],
      providers: [
        { provide: ConsoleSkillsService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleSkillsController);
    service = module.get(ConsoleSkillsService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('GET /catalog delegates to service', async () => {
    const catalogData = { packs: [{ slug: 'aesthetic', skills: [] }] };
    service.getCatalog.mockResolvedValue(catalogData as any);

    const result = await controller.getCatalog(mockUser);

    expect(service.getCatalog).toHaveBeenCalled();
    expect(result).toEqual(catalogData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'SKILLS_CATALOG_VIEW',
    );
  });

  it('GET /:agentType/adoption delegates to service', async () => {
    const adoptionData = { agentType: 'WAITLIST', name: 'Waitlist Matching', enabledCount: 5 };
    service.getSkillAdoption.mockResolvedValue(adoptionData as any);

    const result = await controller.getSkillAdoption('WAITLIST', mockUser);

    expect(service.getSkillAdoption).toHaveBeenCalledWith('WAITLIST');
    expect(result).toEqual(adoptionData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'SKILL_ADOPTION_VIEW',
      expect.objectContaining({ targetType: 'SKILL', targetId: 'WAITLIST' }),
    );
  });

  it('POST /:agentType/platform-override delegates and audit logs', async () => {
    const overrideData = { agentType: 'WAITLIST', enabled: true, affectedCount: 5 };
    service.platformOverride.mockResolvedValue(overrideData);

    const result = await controller.platformOverride(
      'WAITLIST',
      { enabled: true, reason: 'Critical fix' },
      mockUser,
    );

    expect(service.platformOverride).toHaveBeenCalledWith('WAITLIST', true, 'admin1');
    expect(result).toEqual(overrideData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'SKILL_PLATFORM_OVERRIDE',
      expect.objectContaining({
        targetType: 'SKILL',
        targetId: 'WAITLIST',
        reason: 'Critical fix',
        metadata: { enabled: true, affectedCount: 5 },
      }),
    );
  });

  it('POST /:agentType/platform-override without optional reason', async () => {
    const overrideData = { agentType: 'RETENTION', enabled: false, affectedCount: 3 };
    service.platformOverride.mockResolvedValue(overrideData);

    const result = await controller.platformOverride(
      'RETENTION',
      { enabled: false } as any,
      mockUser,
    );

    expect(service.platformOverride).toHaveBeenCalledWith('RETENTION', false, 'admin1');
    expect(result).toEqual(overrideData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'SKILL_PLATFORM_OVERRIDE',
      expect.objectContaining({
        targetType: 'SKILL',
        targetId: 'RETENTION',
        metadata: { enabled: false, affectedCount: 3 },
      }),
    );
  });
});
