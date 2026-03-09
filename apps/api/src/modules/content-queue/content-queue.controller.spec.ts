import { ContentQueueController } from './content-queue.controller';
import { ContentQueueService } from './content-queue.service';

describe('ContentQueueController', () => {
  let controller: ContentQueueController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      bulkApprove: jest.fn(),
      bulkReject: jest.fn(),
      getStats: jest.fn(),
    };
    controller = new ContentQueueController(mockService as unknown as ContentQueueService);
  });

  it('create delegates to service with businessId and body', async () => {
    const body = {
      title: 'Post',
      body: 'Content',
      contentType: 'SOCIAL_POST',
      channel: 'INSTAGRAM',
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

  it('findOne delegates to service with businessId and id', async () => {
    mockService.findOne.mockResolvedValue({ id: 'cd1' });

    const result = await controller.findOne('biz1', 'cd1');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'cd1');
    expect(result).toEqual({ id: 'cd1' });
  });

  it('update delegates to service with businessId, id, and body', async () => {
    const body = { title: 'Updated' };
    mockService.update.mockResolvedValue({ id: 'cd1', title: 'Updated' });

    const result = await controller.update('biz1', 'cd1', body as any);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'cd1', body);
    expect(result).toEqual({ id: 'cd1', title: 'Updated' });
  });

  it('approve delegates to service with businessId, id, user.id, and scheduledFor', async () => {
    const user = { id: 'staff1', role: 'ADMIN' };
    mockService.approve.mockResolvedValue({ id: 'cd1', status: 'SCHEDULED' });

    const result = await controller.approve('biz1', 'cd1', user, {
      scheduledFor: '2026-04-01T10:00:00Z',
    });

    expect(mockService.approve).toHaveBeenCalledWith(
      'biz1',
      'cd1',
      'staff1',
      '2026-04-01T10:00:00Z',
    );
    expect(result).toEqual({ id: 'cd1', status: 'SCHEDULED' });
  });

  it('reject delegates to service with businessId, id, user.id, and reviewNote', async () => {
    const user = { id: 'staff1', role: 'ADMIN' };
    mockService.reject.mockResolvedValue({ id: 'cd1', status: 'REJECTED' });

    const result = await controller.reject('biz1', 'cd1', user, { reviewNote: 'Off brand' });

    expect(mockService.reject).toHaveBeenCalledWith('biz1', 'cd1', 'staff1', 'Off brand');
    expect(result).toEqual({ id: 'cd1', status: 'REJECTED' });
  });

  it('bulkApprove delegates to service with businessId, ids, and user.id', async () => {
    const user = { id: 'staff1', role: 'ADMIN' };
    mockService.bulkApprove.mockResolvedValue({ updated: 3 });

    const result = await controller.bulkApprove('biz1', user, { ids: ['cd1', 'cd2', 'cd3'] });

    expect(mockService.bulkApprove).toHaveBeenCalledWith('biz1', ['cd1', 'cd2', 'cd3'], 'staff1');
    expect(result).toEqual({ updated: 3 });
  });

  it('bulkReject delegates to service with businessId, ids, user.id, and reviewNote', async () => {
    const user = { id: 'staff1', role: 'ADMIN' };
    mockService.bulkReject.mockResolvedValue({ updated: 2 });

    const result = await controller.bulkReject('biz1', user, {
      ids: ['cd1', 'cd2'],
      reviewNote: 'Not approved',
    });

    expect(mockService.bulkReject).toHaveBeenCalledWith(
      'biz1',
      ['cd1', 'cd2'],
      'staff1',
      'Not approved',
    );
    expect(result).toEqual({ updated: 2 });
  });

  it('getStats delegates to service with businessId', async () => {
    const stats = { byStatus: {}, byContentType: {}, byChannel: {} };
    mockService.getStats.mockResolvedValue(stats);

    const result = await controller.getStats('biz1');

    expect(mockService.getStats).toHaveBeenCalledWith('biz1');
    expect(result).toEqual(stats);
  });
});
