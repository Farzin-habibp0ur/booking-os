import { ActionCardController } from './action-card.controller';
import { ActionCardService } from './action-card.service';

describe('ActionCardController', () => {
  let controller: ActionCardController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn(),
      getPendingCount: jest.fn(),
      getSummary: jest.fn(),
      bulkUpdate: jest.fn(),
      findById: jest.fn(),
      approve: jest.fn(),
      dismiss: jest.fn(),
      snooze: jest.fn(),
      execute: jest.fn(),
    };
    controller = new ActionCardController(
      mockService as unknown as ActionCardService,
      {} as any,
    );
  });

  it('findAll delegates to service with businessId and filters', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll(
      'biz1',
      'PENDING',
      'BOOKING',
      'REMINDER',
      'staff1',
      '2',
      '10',
    );

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', {
      status: 'PENDING',
      category: 'BOOKING',
      type: 'REMINDER',
      staffId: 'staff1',
      page: 2,
      pageSize: 10,
    });
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('findAll passes undefined for missing optional params', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    await controller.findAll('biz1');

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', {
      status: undefined,
      category: undefined,
      type: undefined,
      staffId: undefined,
      page: undefined,
      pageSize: undefined,
    });
  });

  it('pendingCount delegates to getPendingCount with businessId and staffId', async () => {
    mockService.getPendingCount.mockResolvedValue({ count: 5 });

    const result = await controller.pendingCount('biz1', 'staff1');

    expect(mockService.getPendingCount).toHaveBeenCalledWith('biz1', 'staff1');
    expect(result).toEqual({ count: 5 });
  });

  it('getSummary delegates to service with businessId', async () => {
    mockService.getSummary.mockResolvedValue({ total: 10, pending: 3 });

    const result = await controller.getSummary('biz1');

    expect(mockService.getSummary).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ total: 10, pending: 3 });
  });

  it('bulkUpdate delegates to service with businessId, cardIds, status, and staffId', async () => {
    const body = { cardIds: ['c1', 'c2'], status: 'APPROVED' };
    mockService.bulkUpdate.mockResolvedValue({ updated: 2 });

    const result = await controller.bulkUpdate('biz1', 'staff1', body as any);

    expect(mockService.bulkUpdate).toHaveBeenCalledWith('biz1', ['c1', 'c2'], 'APPROVED', 'staff1');
    expect(result).toEqual({ updated: 2 });
  });

  it('findById delegates to service with businessId and id', async () => {
    mockService.findById.mockResolvedValue({ id: 'c1' });

    const result = await controller.findById('biz1', 'c1');

    expect(mockService.findById).toHaveBeenCalledWith('biz1', 'c1');
    expect(result).toEqual({ id: 'c1' });
  });

  it('approve delegates to service with businessId, id, staffId, and staffName', async () => {
    mockService.approve.mockResolvedValue({ id: 'c1', status: 'APPROVED' });

    const result = await controller.approve('biz1', 'c1', 'staff1', 'John');

    expect(mockService.approve).toHaveBeenCalledWith('biz1', 'c1', 'staff1', 'John');
    expect(result).toEqual({ id: 'c1', status: 'APPROVED' });
  });

  it('dismiss delegates to service with businessId, id, staffId, and staffName', async () => {
    mockService.dismiss.mockResolvedValue({ id: 'c1', status: 'DISMISSED' });

    const result = await controller.dismiss('biz1', 'c1', 'staff1', 'John');

    expect(mockService.dismiss).toHaveBeenCalledWith('biz1', 'c1', 'staff1', 'John');
    expect(result).toEqual({ id: 'c1', status: 'DISMISSED' });
  });

  it('snooze delegates to service with businessId, id, Date, and staffId', async () => {
    const until = '2026-04-01T12:00:00Z';
    mockService.snooze.mockResolvedValue({ id: 'c1', status: 'SNOOZED' });

    const result = await controller.snooze('biz1', 'c1', 'staff1', { until });

    expect(mockService.snooze).toHaveBeenCalledWith('biz1', 'c1', new Date(until), 'staff1');
    expect(result).toEqual({ id: 'c1', status: 'SNOOZED' });
  });

  it('execute delegates to service with businessId, id, staffId, and staffName', async () => {
    mockService.execute.mockResolvedValue({ id: 'c1', status: 'EXECUTED' });

    const result = await controller.execute('biz1', 'c1', 'staff1', 'John');

    expect(mockService.execute).toHaveBeenCalledWith('biz1', 'c1', 'staff1', 'John');
    expect(result).toEqual({ id: 'c1', status: 'EXECUTED' });
  });
});
