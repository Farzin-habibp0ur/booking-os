import { AgentRunsController } from './agent-runs.controller';
import { AgentRunsService } from './agent-runs.service';

describe('AgentRunsController', () => {
  let controller: AgentRunsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn(),
      getStats: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new AgentRunsController(
      mockService as unknown as AgentRunsService,
    );
  });

  it('findAll delegates to service with businessId and query', async () => {
    const query = { agentType: 'BLOG_WRITER', page: 1, pageSize: 10 } as any;
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll('biz1', query);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStats delegates to service with businessId', async () => {
    mockService.getStats.mockResolvedValue({ totalRuns: 50, failures: 2 });

    const result = await controller.getStats('biz1');

    expect(mockService.getStats).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ totalRuns: 50, failures: 2 });
  });

  it('findOne delegates to service with businessId and id', async () => {
    mockService.findOne.mockResolvedValue({ id: 'run1', status: 'COMPLETED' });

    const result = await controller.findOne('biz1', 'run1');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'run1');
    expect(result).toEqual({ id: 'run1', status: 'COMPLETED' });
  });
});
