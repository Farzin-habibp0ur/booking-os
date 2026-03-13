import { AgentConfigController } from './agent-config.controller';
import { AgentConfigService } from './agent-config.service';

describe('AgentConfigController', () => {
  let controller: AgentConfigController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn(),
      getPerformanceSummary: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      runNow: jest.fn(),
    };
    controller = new AgentConfigController(
      mockService as unknown as AgentConfigService,
    );
  });

  it('findAll delegates to service with businessId', async () => {
    mockService.findAll.mockResolvedValue([{ agentType: 'BLOG_WRITER' }]);

    const result = await controller.findAll('biz1');

    expect(mockService.findAll).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([{ agentType: 'BLOG_WRITER' }]);
  });

  it('getPerformanceSummary delegates to service with businessId', async () => {
    mockService.getPerformanceSummary.mockResolvedValue({ totalRuns: 10, successRate: 0.9 });

    const result = await controller.getPerformanceSummary('biz1');

    expect(mockService.getPerformanceSummary).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ totalRuns: 10, successRate: 0.9 });
  });

  it('findOne delegates to service with businessId and agentType', async () => {
    mockService.findOne.mockResolvedValue({ agentType: 'TREND_ANALYZER', enabled: true });

    const result = await controller.findOne('biz1', 'TREND_ANALYZER');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'TREND_ANALYZER');
    expect(result).toEqual({ agentType: 'TREND_ANALYZER', enabled: true });
  });

  it('update delegates to service with businessId, agentType, and body', async () => {
    const body = { enabled: false } as any;
    mockService.update.mockResolvedValue({ agentType: 'BLOG_WRITER', enabled: false });

    const result = await controller.update('biz1', 'BLOG_WRITER', body);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'BLOG_WRITER', body);
    expect(result).toEqual({ agentType: 'BLOG_WRITER', enabled: false });
  });

  it('runNow delegates to service with businessId and agentType', async () => {
    mockService.runNow.mockResolvedValue({ queued: true });

    const result = await controller.runNow('biz1', 'BLOG_WRITER');

    expect(mockService.runNow).toHaveBeenCalledWith('biz1', 'BLOG_WRITER');
    expect(result).toEqual({ queued: true });
  });
});
