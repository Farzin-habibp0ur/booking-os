import { EscalationController } from './escalation.controller';
import { EscalationService } from './escalation.service';

describe('EscalationController', () => {
  let controller: EscalationController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      getHistory: jest.fn(),
      getStats: jest.fn(),
    };
    controller = new EscalationController(
      mockService as unknown as EscalationService,
    );
  });

  it('getHistory delegates to service with businessId and query', async () => {
    const query = { tier: 'RED', page: 1 };
    mockService.getHistory.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.getHistory('biz1', query as any);

    expect(mockService.getHistory).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStats delegates to service with businessId', async () => {
    mockService.getStats.mockResolvedValue({ totalEscalations: 12, byTier: {} });

    const result = await controller.getStats('biz1');

    expect(mockService.getStats).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ totalEscalations: 12, byTier: {} });
  });

  it('getHistory passes empty query object', async () => {
    const query = {};
    mockService.getHistory.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.getHistory('biz1', query as any);

    expect(mockService.getHistory).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual({ data: [], total: 0 });
  });
});
