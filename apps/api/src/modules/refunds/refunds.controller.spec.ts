import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

describe('RefundsController', () => {
  let controller: RefundsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new RefundsController(mockService as unknown as RefundsService);
  });

  it('create delegates to service with businessId and user id', async () => {
    const body = { paymentId: 'pay1', amount: 50 };
    const user = { id: 'staff1', role: 'ADMIN' };
    mockService.create.mockResolvedValue({ id: 'r1' });

    const result = await controller.create('biz1', body as any, user);

    expect(mockService.create).toHaveBeenCalledWith('biz1', body, 'staff1');
    expect(result).toEqual({ id: 'r1' });
  });

  it('findAll delegates to service', async () => {
    const query = { paymentId: 'pay1' };
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll('biz1', query as any);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('findOne delegates to service', async () => {
    mockService.findOne.mockResolvedValue({ id: 'r1' });

    const result = await controller.findOne('biz1', 'r1');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'r1');
    expect(result).toEqual({ id: 'r1' });
  });
});
