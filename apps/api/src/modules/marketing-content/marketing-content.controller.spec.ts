import { MarketingContentController } from './marketing-content.controller';
import { MarketingContentService } from './marketing-content.service';

describe('MarketingContentController', () => {
  let controller: MarketingContentController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      review: jest.fn(),
      bulkReview: jest.fn(),
      remove: jest.fn(),
      getPipelineStats: jest.fn(),
      getPillarBalance: jest.fn(),
    };
    controller = new MarketingContentController(mockService as unknown as MarketingContentService);
  });

  it('create delegates to service with businessId and body', async () => {
    const body = {
      contentType: 'SOCIAL_POST',
      title: 'Test',
      body: 'Content',
      tier: 'GREEN',
      channel: 'INSTAGRAM',
      pillar: 'PRODUCT_EDUCATION',
      agentId: 'agent1',
    };
    mockService.create.mockResolvedValue({ id: 'cd1' });

    const result = await controller.create('biz1', body as any);

    expect(mockService.create).toHaveBeenCalledWith('biz1', body);
    expect(result).toEqual({ id: 'cd1' });
  });

  it('findAll delegates to service with businessId and query', async () => {
    const query = { status: 'PENDING_REVIEW' };
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll('biz1', query as any);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStats delegates to getPipelineStats', async () => {
    mockService.getPipelineStats.mockResolvedValue({ byStatus: {} });

    const result = await controller.getStats('biz1');

    expect(mockService.getPipelineStats).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ byStatus: {} });
  });

  it('getPillarBalance delegates to service', async () => {
    mockService.getPillarBalance.mockResolvedValue({ distribution: [], total: 0 });

    const result = await controller.getPillarBalance('biz1');

    expect(mockService.getPillarBalance).toHaveBeenCalledWith('biz1');
  });

  it('findOne delegates to service with businessId and id', async () => {
    mockService.findOne.mockResolvedValue({ id: 'cd1' });

    const result = await controller.findOne('biz1', 'cd1');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'cd1');
    expect(result).toEqual({ id: 'cd1' });
  });

  it('update delegates to service', async () => {
    const body = { title: 'Updated' };
    mockService.update.mockResolvedValue({ id: 'cd1', title: 'Updated' });

    const result = await controller.update('biz1', 'cd1', body as any);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'cd1', body);
  });

  it('review delegates to service with user id', async () => {
    const user = { id: 'staff1', role: 'ADMIN' };
    const body = { action: 'APPROVE' };
    mockService.review.mockResolvedValue({ id: 'cd1', status: 'APPROVED' });

    const result = await controller.review('biz1', 'cd1', user, body as any);

    expect(mockService.review).toHaveBeenCalledWith('biz1', 'cd1', 'staff1', body);
  });

  it('bulkReview delegates to service with user id', async () => {
    const user = { id: 'staff1' };
    const body = { draftIds: ['cd1', 'cd2'], action: 'APPROVE' };
    mockService.bulkReview.mockResolvedValue({ updated: 2 });

    const result = await controller.bulkReview('biz1', user, body as any);

    expect(mockService.bulkReview).toHaveBeenCalledWith('biz1', 'staff1', body);
    expect(result).toEqual({ updated: 2 });
  });

  it('remove delegates to service', async () => {
    mockService.remove.mockResolvedValue({ id: 'cd1', status: 'DRAFT' });

    const result = await controller.remove('biz1', 'cd1');

    expect(mockService.remove).toHaveBeenCalledWith('biz1', 'cd1');
  });
});
