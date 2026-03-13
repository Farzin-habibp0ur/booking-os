import { Test } from '@nestjs/testing';
import { AbTestingController } from './ab-testing.controller';
import { AbTestingService } from './ab-testing.service';

describe('AbTestingController', () => {
  let controller: AbTestingController;
  let mockService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findActive: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    start: jest.Mock;
    complete: jest.Mock;
    cancel: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn().mockResolvedValue({ id: 'test1', name: 'CTA Test' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findActive: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'test1' }),
      update: jest.fn().mockResolvedValue({ id: 'test1', name: 'Updated' }),
      start: jest.fn().mockResolvedValue({ id: 'test1', status: 'RUNNING' }),
      complete: jest.fn().mockResolvedValue({ id: 'test1', status: 'COMPLETED' }),
      cancel: jest.fn().mockResolvedValue({ id: 'test1', status: 'CANCELLED' }),
    };

    const module = await Test.createTestingModule({
      controllers: [AbTestingController],
      providers: [{ provide: AbTestingService, useValue: mockService }],
    }).compile();

    controller = module.get(AbTestingController);
  });

  it('delegates create to service', async () => {
    const dto = { name: 'CTA Test', elementType: 'CTA' };
    const result = await controller.create('biz1', dto as any);

    expect(mockService.create).toHaveBeenCalledWith('biz1', dto);
    expect(result).toEqual({ id: 'test1', name: 'CTA Test' });
  });

  it('delegates findAll to service', async () => {
    const query = { status: 'RUNNING' };
    await controller.findAll('biz1', query as any);

    expect(mockService.findAll).toHaveBeenCalledWith('biz1', query);
  });

  it('delegates findActive to service', async () => {
    await controller.findActive('biz1');

    expect(mockService.findActive).toHaveBeenCalledWith('biz1');
  });

  it('delegates findOne to service', async () => {
    await controller.findOne('biz1', 'test1');

    expect(mockService.findOne).toHaveBeenCalledWith('biz1', 'test1');
  });

  it('delegates update to service', async () => {
    const dto = { name: 'Updated' };
    const result = await controller.update('biz1', 'test1', dto as any);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'test1', dto);
    expect(result).toEqual({ id: 'test1', name: 'Updated' });
  });

  it('delegates start to service', async () => {
    const result = await controller.start('biz1', 'test1');

    expect(mockService.start).toHaveBeenCalledWith('biz1', 'test1');
    expect(result.status).toBe('RUNNING');
  });

  it('delegates complete to service', async () => {
    const result = await controller.complete('biz1', 'test1');

    expect(mockService.complete).toHaveBeenCalledWith('biz1', 'test1');
    expect(result.status).toBe('COMPLETED');
  });

  it('delegates cancel to service', async () => {
    const result = await controller.cancel('biz1', 'test1');

    expect(mockService.cancel).toHaveBeenCalledWith('biz1', 'test1');
    expect(result.status).toBe('CANCELLED');
  });
});
