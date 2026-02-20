import { Test } from '@nestjs/testing';
import {
  ConsoleBillingController,
  ConsoleBusinessBillingController,
} from './console-billing.controller';
import { ConsoleBillingService } from './console-billing.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleBillingController', () => {
  let controller: ConsoleBillingController;
  let service: jest.Mocked<ConsoleBillingService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockService = {
      getDashboard: jest.fn(),
      getPastDue: jest.fn(),
      getSubscriptions: jest.fn(),
      getBillingForBusiness: jest.fn(),
      getInvoicesForBusiness: jest.fn(),
      changePlan: jest.fn(),
      issueCredit: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      getCreditsForBusiness: jest.fn(),
    };

    const mockAuditService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [ConsoleBillingController],
      providers: [
        { provide: ConsoleBillingService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleBillingController);
    service = module.get(ConsoleBillingService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('GET /dashboard delegates to service', async () => {
    const dashboardData = { mrr: 500, activeCount: 10 };
    service.getDashboard.mockResolvedValue(dashboardData as any);

    const result = await controller.getDashboard(mockUser);

    expect(service.getDashboard).toHaveBeenCalled();
    expect(result).toEqual(dashboardData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_DASHBOARD_VIEW',
    );
  });

  it('GET /past-due delegates to service', async () => {
    const pastDueData = [{ id: 'sub1', daysPastDue: 5 }];
    service.getPastDue.mockResolvedValue(pastDueData as any);

    const result = await controller.getPastDue(mockUser);

    expect(service.getPastDue).toHaveBeenCalled();
    expect(result).toEqual(pastDueData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_PAST_DUE_VIEW',
    );
  });

  it('GET /subscriptions delegates with query params', async () => {
    const subData = { items: [], total: 0, page: 1, pageSize: 20 };
    service.getSubscriptions.mockResolvedValue(subData);

    const query = { search: 'test', plan: 'pro' as const };
    const result = await controller.getSubscriptions(query, mockUser);

    expect(service.getSubscriptions).toHaveBeenCalledWith(query);
    expect(result).toEqual(subData);
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_SUBSCRIPTIONS_VIEW',
      expect.objectContaining({
        metadata: expect.objectContaining({ search: 'test' }),
      }),
    );
  });
});

describe('ConsoleBusinessBillingController', () => {
  let controller: ConsoleBusinessBillingController;
  let service: jest.Mocked<ConsoleBillingService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockService = {
      getDashboard: jest.fn(),
      getPastDue: jest.fn(),
      getSubscriptions: jest.fn(),
      getBillingForBusiness: jest.fn(),
      getInvoicesForBusiness: jest.fn(),
      changePlan: jest.fn(),
      issueCredit: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      getCreditsForBusiness: jest.fn(),
    };

    const mockAuditService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [ConsoleBusinessBillingController],
      providers: [
        { provide: ConsoleBillingService, useValue: mockService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleBusinessBillingController);
    service = module.get(ConsoleBillingService) as any;
    auditService = module.get(PlatformAuditService) as any;
  });

  it('POST change-plan delegates and logs audit', async () => {
    service.changePlan.mockResolvedValue({
      subscription: { id: 'sub1', plan: 'pro' },
      oldPlan: 'basic',
      newPlan: 'pro',
    } as any);

    const result = await controller.changePlan(
      'biz1',
      { newPlan: 'pro', reason: 'Customer upgrade' },
      mockUser,
    );

    expect(service.changePlan).toHaveBeenCalledWith(
      'biz1',
      'pro',
      'Customer upgrade',
      'admin1',
      'admin@test.com',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_PLAN_CHANGE',
      expect.objectContaining({
        targetType: 'BUSINESS',
        targetId: 'biz1',
        reason: 'Customer upgrade',
        metadata: { oldPlan: 'basic', newPlan: 'pro' },
      }),
    );
  });

  it('POST credit delegates and logs audit', async () => {
    service.issueCredit.mockResolvedValue({
      id: 'credit1',
      amount: 50,
    } as any);

    const result = await controller.issueCredit(
      'biz1',
      { amount: 50, reason: 'Goodwill credit' },
      mockUser,
    );

    expect(service.issueCredit).toHaveBeenCalledWith(
      'biz1',
      50,
      'Goodwill credit',
      undefined,
      'admin1',
      'admin@test.com',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_CREDIT_ISSUED',
      expect.objectContaining({
        targetType: 'BUSINESS',
        targetId: 'biz1',
      }),
    );
  });

  it('POST cancel delegates and logs audit', async () => {
    service.cancelSubscription.mockResolvedValue({
      id: 'sub1',
      status: 'canceled',
    } as any);

    await controller.cancelSubscription(
      'biz1',
      { reason: 'Non-payment', immediate: true },
      mockUser,
    );

    expect(service.cancelSubscription).toHaveBeenCalledWith(
      'biz1',
      'Non-payment',
      true,
      'admin1',
      'admin@test.com',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_CANCEL',
      expect.objectContaining({
        targetType: 'BUSINESS',
        targetId: 'biz1',
        reason: 'Non-payment',
        metadata: { immediate: true },
      }),
    );
  });

  it('POST reactivate delegates and logs audit', async () => {
    service.reactivateSubscription.mockResolvedValue({
      id: 'sub1',
      status: 'active',
    } as any);

    await controller.reactivateSubscription('biz1', mockUser);

    expect(service.reactivateSubscription).toHaveBeenCalledWith(
      'biz1',
      'admin1',
      'admin@test.com',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'BILLING_REACTIVATE',
      expect.objectContaining({ targetType: 'BUSINESS', targetId: 'biz1' }),
    );
  });

  it('GET billing delegates to service', async () => {
    const billingData = { subscription: { plan: 'pro' }, credits: [], recentInvoices: [] };
    service.getBillingForBusiness.mockResolvedValue(billingData as any);

    const result = await controller.getBilling('biz1', mockUser);

    expect(service.getBillingForBusiness).toHaveBeenCalledWith('biz1');
    expect(result).toEqual(billingData);
  });

  it('GET credits delegates to service', async () => {
    service.getCreditsForBusiness.mockResolvedValue([]);

    const result = await controller.getCredits('biz1', mockUser);

    expect(service.getCreditsForBusiness).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([]);
  });
});
