import { Test } from '@nestjs/testing';
import { ConsoleAgentsController } from './console-agents.controller';
import { ConsoleAgentsService } from './console-agents.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleAgentsController', () => {
  let controller: ConsoleAgentsController;
  let service: jest.Mocked<ConsoleAgentsService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockService = {
      getPerformanceDashboard: jest.fn(),
      getActionCardFunnel: jest.fn(),
      getTopFailures: jest.fn(),
      getAbnormalTenants: jest.fn(),
      getTenantAgentStatus: jest.fn(),
      pauseAllAgents: jest.fn(),
      resumeAllAgents: jest.fn(),
      updateTenantAgent: jest.fn(),
      getPlatformDefaults: jest.fn(),
      updatePlatformDefault: jest.fn(),
    };

    const mockAuditService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [ConsoleAgentsController],
      providers: [
        { provide: ConsoleAgentsService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleAgentsController);
    service = module.get(ConsoleAgentsService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('GET /performance delegates to service', async () => {
    const data = { totalRuns: 10, successRate: 90 };
    service.getPerformanceDashboard.mockResolvedValue(data as any);

    const result = await controller.getPerformance(mockUser);

    expect(service.getPerformanceDashboard).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_PERFORMANCE_VIEW',
    );
  });

  it('GET /funnel delegates to service', async () => {
    const data = { total: 100, pending: 20 };
    service.getActionCardFunnel.mockResolvedValue(data as any);

    const result = await controller.getFunnel(mockUser);

    expect(service.getActionCardFunnel).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith('admin1', 'admin@test.com', 'AGENT_FUNNEL_VIEW');
  });

  it('GET /failures delegates to service', async () => {
    const data = [{ error: 'timeout', count: 5 }];
    service.getTopFailures.mockResolvedValue(data as any);

    const result = await controller.getFailures(mockUser);

    expect(service.getTopFailures).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_FAILURES_VIEW',
    );
  });

  it('GET /abnormal-tenants delegates to service', async () => {
    const data = [{ businessId: 'biz1', failureRate: 80 }];
    service.getAbnormalTenants.mockResolvedValue(data as any);

    const result = await controller.getAbnormalTenants(mockUser);

    expect(service.getAbnormalTenants).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_ABNORMAL_TENANTS_VIEW',
    );
  });

  it('GET /tenant/:businessId delegates to service', async () => {
    const data = { businessId: 'biz1', businessName: 'Test', agents: [] };
    service.getTenantAgentStatus.mockResolvedValue(data as any);

    const result = await controller.getTenantAgentStatus('biz1', mockUser);

    expect(service.getTenantAgentStatus).toHaveBeenCalledWith('biz1');
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_TENANT_STATUS_VIEW',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
  });

  it('POST /tenant/:businessId/pause-all delegates and audit logs with reason', async () => {
    service.pauseAllAgents.mockResolvedValue({ affectedCount: 3 });

    const result = await controller.pauseAllAgents('biz1', { reason: 'Security review' }, mockUser);

    expect(service.pauseAllAgents).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ affectedCount: 3 });
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_PAUSE_ALL',
      expect.objectContaining({
        targetType: 'BUSINESS',
        targetId: 'biz1',
        reason: 'Security review',
      }),
    );
  });

  it('POST /tenant/:businessId/resume-all delegates and audit logs with reason', async () => {
    service.resumeAllAgents.mockResolvedValue({ affectedCount: 3 });

    const result = await controller.resumeAllAgents(
      'biz1',
      { reason: 'Review complete' },
      mockUser,
    );

    expect(service.resumeAllAgents).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ affectedCount: 3 });
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_RESUME_ALL',
      expect.objectContaining({
        targetType: 'BUSINESS',
        targetId: 'biz1',
        reason: 'Review complete',
      }),
    );
  });

  it('POST /tenant/:businessId/agent/:agentType delegates and audit logs', async () => {
    const config = { id: 'cfg1', agentType: 'WAITLIST', isEnabled: false };
    service.updateTenantAgent.mockResolvedValue(config as any);

    const result = await controller.updateTenantAgent(
      'biz1',
      'WAITLIST',
      { isEnabled: false, reason: 'Too aggressive' } as any,
      mockUser,
    );

    expect(service.updateTenantAgent).toHaveBeenCalledWith('biz1', 'WAITLIST', {
      isEnabled: false,
      autonomyLevel: undefined,
    });
    expect(result).toEqual(config);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_TENANT_UPDATE',
      expect.objectContaining({
        targetType: 'AGENT_CONFIG',
        targetId: 'biz1/WAITLIST',
        reason: 'Too aggressive',
      }),
    );
  });

  it('GET /platform-defaults delegates to service', async () => {
    const data = [{ agentType: 'WAITLIST', maxAutonomyLevel: 'SUGGEST' }];
    service.getPlatformDefaults.mockResolvedValue(data as any);

    const result = await controller.getPlatformDefaults(mockUser);

    expect(service.getPlatformDefaults).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_PLATFORM_DEFAULTS_VIEW',
    );
  });

  it('PUT /platform-defaults/:agentType delegates and audit logs', async () => {
    const data = {
      maxAutonomyLevel: 'AUTO',
      defaultEnabled: true,
      confidenceThreshold: 0.8,
      requiresReview: false,
    };
    const updated = { id: 'd1', agentType: 'WAITLIST', ...data };
    service.updatePlatformDefault.mockResolvedValue(updated as any);

    const result = await controller.updatePlatformDefault('WAITLIST', data, mockUser);

    expect(service.updatePlatformDefault).toHaveBeenCalledWith('WAITLIST', data, 'admin1');
    expect(result).toEqual(updated);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'AGENT_PLATFORM_DEFAULT_UPDATE',
      expect.objectContaining({
        targetType: 'PLATFORM_AGENT_DEFAULT',
        targetId: 'WAITLIST',
        metadata: expect.objectContaining({ maxAutonomyLevel: 'AUTO' }),
      }),
    );
  });
});
