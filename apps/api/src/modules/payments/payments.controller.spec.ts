import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      summary: jest.fn(),
      update: jest.fn(),
    };
    controller = new PaymentsController(mockService as unknown as PaymentsService);
  });

  it('create delegates to service with businessId and user id', async () => {
    const body = { amount: 100, method: 'CASH' };
    const user = { id: 'staff1', role: 'ADMIN' };
    mockService.create.mockResolvedValue({ id: 'p1' });

    const result = await controller.create('biz1', body as any, user);

    expect(mockService.create).toHaveBeenCalledWith('biz1', body, 'staff1');
    expect(result).toEqual({ id: 'p1' });
  });

  it('findAll delegates to service with businessId and query', async () => {
    const query = { bookingId: 'b1' };
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll('biz1', query as any);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('findOne delegates to service', async () => {
    mockService.findOne.mockResolvedValue({ id: 'p1' });

    const result = await controller.findOne('biz1', 'p1');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'p1');
    expect(result).toEqual({ id: 'p1' });
  });

  it('summary delegates to service with date range', async () => {
    mockService.summary.mockResolvedValue({ totalAmount: 500, count: 3 });

    const result = await controller.summary('biz1', '2026-01-01', '2026-01-31');

    expect(mockService.summary).toHaveBeenCalledWith('biz1', '2026-01-01', '2026-01-31');
    expect(result).toEqual({ totalAmount: 500, count: 3 });
  });

  it('summary works without date range', async () => {
    mockService.summary.mockResolvedValue({ totalAmount: 0, count: 0 });

    const result = await controller.summary('biz1', undefined, undefined);

    expect(mockService.summary).toHaveBeenCalledWith('biz1', undefined, undefined);
    expect(result).toEqual({ totalAmount: 0, count: 0 });
  });

  it('update delegates to service', async () => {
    const body = { notes: 'updated' };
    mockService.update.mockResolvedValue({ id: 'p1', notes: 'updated' });

    const result = await controller.update('biz1', 'p1', body as any);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'p1', body);
    expect(result).toEqual({ id: 'p1', notes: 'updated' });
  });
});
