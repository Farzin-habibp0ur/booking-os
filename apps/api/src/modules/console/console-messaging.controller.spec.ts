import { Test } from '@nestjs/testing';
import { ConsoleMessagingController } from './console-messaging.controller';
import { ConsoleMessagingService } from './console-messaging.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleMessagingController', () => {
  let controller: ConsoleMessagingController;
  let service: jest.Mocked<ConsoleMessagingService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockService = {
      getDashboard: jest.fn(),
      getFailures: jest.fn(),
      getWebhookHealth: jest.fn(),
      getTenantStatus: jest.fn(),
      getFixChecklist: jest.fn(),
    };

    const mockAuditService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [ConsoleMessagingController],
      providers: [
        { provide: ConsoleMessagingService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleMessagingController);
    service = module.get(ConsoleMessagingService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('GET /dashboard delegates to service', async () => {
    const data = { messagesSent: 100, deliveryRate: 95 };
    service.getDashboard.mockResolvedValue(data as any);

    const result = await controller.getDashboard(mockUser);

    expect(service.getDashboard).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'MESSAGING_DASHBOARD_VIEW',
    );
  });

  it('GET /failures delegates to service', async () => {
    const data = { topReasons: [], impactedTenants: [] };
    service.getFailures.mockResolvedValue(data as any);

    const result = await controller.getFailures(mockUser);

    expect(service.getFailures).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'MESSAGING_FAILURES_VIEW',
    );
  });

  it('GET /webhook-health delegates to service', async () => {
    const data = { isHealthy: true, recentInbound24h: 50 };
    service.getWebhookHealth.mockResolvedValue(data as any);

    const result = await controller.getWebhookHealth(mockUser);

    expect(service.getWebhookHealth).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'MESSAGING_WEBHOOK_HEALTH_VIEW',
    );
  });

  it('GET /tenant-status delegates to service', async () => {
    const data = [{ businessId: 'biz1', hasWhatsappConfig: true }];
    service.getTenantStatus.mockResolvedValue(data as any);

    const result = await controller.getTenantStatus(mockUser);

    expect(service.getTenantStatus).toHaveBeenCalled();
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'MESSAGING_TENANT_STATUS_VIEW',
    );
  });

  it('GET /tenant/:businessId/fix-checklist delegates and audit logs', async () => {
    const data = { businessName: 'Test', items: [] };
    service.getFixChecklist.mockResolvedValue(data as any);

    const result = await controller.getFixChecklist('biz1', mockUser);

    expect(service.getFixChecklist).toHaveBeenCalledWith('biz1');
    expect(result).toEqual(data);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1', 'admin@test.com', 'MESSAGING_FIX_CHECKLIST_VIEW',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
  });
});
