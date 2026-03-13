import { Test } from '@nestjs/testing';
import { BudgetTrackerController } from './budget-tracker.controller';
import { BudgetTrackerService } from './budget-tracker.service';

describe('BudgetTrackerController', () => {
  let controller: BudgetTrackerController;
  let mockService: {
    create: jest.Mock;
    findAll: jest.Mock;
    getSummary: jest.Mock;
    getRoi: jest.Mock;
    approve: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn().mockResolvedValue({ id: 'entry1', amount: 50 }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getSummary: jest.fn().mockResolvedValue({ totalSpend: 0, budget: 500 }),
      getRoi: jest.fn().mockResolvedValue({ totalSpend: 400, byCategory: {}, budgetRules: [], approvalThresholds: [] }),
      approve: jest.fn().mockResolvedValue({ id: 'entry1', status: 'APPROVED' }),
    };

    const module = await Test.createTestingModule({
      controllers: [BudgetTrackerController],
      providers: [{ provide: BudgetTrackerService, useValue: mockService }],
    }).compile();

    controller = module.get(BudgetTrackerController);
  });

  it('delegates create to service', async () => {
    const dto = { category: 'ANTHROPIC_API', amount: 50, description: 'Monthly usage' };
    const result = await controller.create('biz1', dto as any);

    expect(mockService.create).toHaveBeenCalledWith('biz1', dto);
    expect(result).toEqual({ id: 'entry1', amount: 50 });
  });

  it('delegates findAll to service', async () => {
    const query = { category: 'ANTHROPIC_API' };
    await controller.findAll('biz1', query as any);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
  });

  it('delegates getSummary to service with parsed month and year', async () => {
    await controller.getSummary('biz1', '3', '2026');

    expect(mockService.getSummary).toHaveBeenCalledWith('biz1', 3, 2026);
  });

  it('delegates getSummary with undefined month and year', async () => {
    await controller.getSummary('biz1', undefined, undefined);

    expect(mockService.getSummary).toHaveBeenCalledWith('biz1', undefined, undefined);
  });

  it('delegates getRoi to service', async () => {
    const result = await controller.getRoi('biz1');

    expect(mockService.getRoi).toHaveBeenCalledWith('biz1');
    expect(result.totalSpend).toBe(400);
  });

  it('delegates approve to service with default approverRole', async () => {
    await controller.approve('biz1', 'entry1', undefined as any);

    expect(mockService.approve).toHaveBeenCalledWith('biz1', 'entry1', 'FOUNDER');
  });
});
