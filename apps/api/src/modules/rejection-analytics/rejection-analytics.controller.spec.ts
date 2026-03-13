import { Test } from '@nestjs/testing';
import { RejectionAnalyticsController } from './rejection-analytics.controller';
import { RejectionAnalyticsService } from './rejection-analytics.service';

describe('RejectionAnalyticsController', () => {
  let controller: RejectionAnalyticsController;
  let mockService: {
    getLogs: jest.Mock;
    getWeeklySummary: jest.Mock;
    getStats: jest.Mock;
    getAgentRejectionDetails: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getWeeklySummary: jest.fn().mockResolvedValue({ weekOf: '2026-03-09', totalRejections: 0 }),
      getStats: jest.fn().mockResolvedValue({ totalRejections: 0, byCode: {} }),
      getAgentRejectionDetails: jest.fn().mockResolvedValue({ agentId: 'agent1', rejections: [] }),
    };

    const module = await Test.createTestingModule({
      controllers: [RejectionAnalyticsController],
      providers: [{ provide: RejectionAnalyticsService, useValue: mockService }],
    }).compile();

    controller = module.get(RejectionAnalyticsController);
  });

  it('delegates getLogs to service', async () => {
    const query = { gate: 'GATE_2', skip: '0', take: '20' };
    await controller.getLogs('biz1', query as any);

    expect(mockService.getLogs).toHaveBeenCalledWith('biz1', query);
  });

  it('delegates getWeeklySummary to service', async () => {
    await controller.getWeeklySummary('biz1');

    expect(mockService.getWeeklySummary).toHaveBeenCalledWith('biz1');
  });

  it('delegates getStats to service', async () => {
    await controller.getStats('biz1');

    expect(mockService.getStats).toHaveBeenCalledWith('biz1');
  });

  it('delegates getAgentDetails to service', async () => {
    await controller.getAgentDetails('biz1', 'agent1');

    expect(mockService.getAgentRejectionDetails).toHaveBeenCalledWith('biz1', 'agent1');
  });
});
