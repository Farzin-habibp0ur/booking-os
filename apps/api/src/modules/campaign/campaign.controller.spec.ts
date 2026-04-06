import { CampaignController } from './campaign.controller';

function createMockCampaignService() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'camp1' }),
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 'camp1' }),
    update: jest.fn().mockResolvedValue({ id: 'camp1' }),
    delete: jest.fn().mockResolvedValue({ deleted: true }),
    sendCampaign: jest.fn().mockResolvedValue({ status: 'SENDING' }),
    cancelCampaign: jest
      .fn()
      .mockResolvedValue({ cancelled: true, sentCount: 0, cancelledCount: 5 }),
    previewAudience: jest.fn().mockResolvedValue({ count: 10 }),
    stopRecurrence: jest.fn().mockResolvedValue({ id: 'camp1' }),
    getVariantStats: jest.fn().mockResolvedValue({ variants: [] }),
    getChannelStats: jest.fn().mockResolvedValue({}),
    getFunnelStats: jest.fn().mockResolvedValue({ stages: [] }),
    selectWinner: jest.fn().mockResolvedValue({ id: 'camp1' }),
    clone: jest.fn().mockResolvedValue({ id: 'camp2' }),
    testSend: jest.fn().mockResolvedValue({ sent: true }),
    estimateCost: jest.fn().mockResolvedValue({ estimatedCost: 0 }),
  };
}

function createMockSegmentService() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'seg1' }),
    update: jest.fn().mockResolvedValue({ id: 'seg1' }),
    delete: jest.fn().mockResolvedValue({ deleted: true }),
  };
}

describe('CampaignController', () => {
  let controller: CampaignController;
  let campaignService: ReturnType<typeof createMockCampaignService>;
  let segmentService: ReturnType<typeof createMockSegmentService>;

  beforeEach(() => {
    campaignService = createMockCampaignService();
    segmentService = createMockSegmentService();
    controller = new CampaignController(campaignService as any, segmentService as any);
  });

  it('create delegates to campaignService.create', async () => {
    const body = { name: 'Test Campaign' } as any;
    const result = await controller.create('biz1', body);
    expect(campaignService.create).toHaveBeenCalledWith('biz1', body);
    expect(result).toEqual({ id: 'camp1' });
  });

  it('findAll delegates to campaignService.findAll', async () => {
    const query = { status: 'DRAFT' };
    await controller.findAll('biz1', query);
    expect(campaignService.findAll).toHaveBeenCalledWith('biz1', query);
  });

  it('findById delegates to campaignService.findById', async () => {
    await controller.findById('biz1', 'camp1');
    expect(campaignService.findById).toHaveBeenCalledWith('biz1', 'camp1');
  });

  it('update delegates to campaignService.update', async () => {
    const body = { name: 'Updated' } as any;
    await controller.update('biz1', 'camp1', body);
    expect(campaignService.update).toHaveBeenCalledWith('biz1', 'camp1', body);
  });

  it('delete delegates to campaignService.delete', async () => {
    await controller.delete('biz1', 'camp1');
    expect(campaignService.delete).toHaveBeenCalledWith('biz1', 'camp1');
  });

  it('send delegates to campaignService.sendCampaign', async () => {
    await controller.send('biz1', 'camp1');
    expect(campaignService.sendCampaign).toHaveBeenCalledWith('biz1', 'camp1');
  });

  it('cancel delegates to campaignService.cancelCampaign', async () => {
    const result = await controller.cancel('biz1', 'camp1');
    expect(campaignService.cancelCampaign).toHaveBeenCalledWith('biz1', 'camp1');
    expect(result).toEqual({ cancelled: true, sentCount: 0, cancelledCount: 5 });
  });

  it('stopRecurrence delegates to campaignService.stopRecurrence', async () => {
    await controller.stopRecurrence('biz1', 'camp1');
    expect(campaignService.stopRecurrence).toHaveBeenCalledWith('biz1', 'camp1');
  });

  it('clone delegates to campaignService.clone', async () => {
    const result = await controller.clone('biz1', 'camp1');
    expect(campaignService.clone).toHaveBeenCalledWith('biz1', 'camp1');
    expect(result).toEqual({ id: 'camp2' });
  });

  it('testSend delegates to campaignService.testSend', async () => {
    await controller.testSend('biz1', 'camp1', { email: 'test@test.com' });
    expect(campaignService.testSend).toHaveBeenCalledWith('biz1', 'camp1', 'test@test.com');
  });
});
