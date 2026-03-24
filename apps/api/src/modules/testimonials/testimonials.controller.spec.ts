import { Test, TestingModule } from '@nestjs/testing';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';
import { AutomationExecutorService } from '../automation/automation-executor.service';

describe('TestimonialsController', () => {
  let controller: TestimonialsController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      feature: jest.fn(),
      delete: jest.fn(),
      sendRequest: jest.fn(),
      findPublic: jest.fn(),
      verifyToken: jest.fn(),
      submitByToken: jest.fn(),
      bulkAction: jest.fn(),
      getDashboardStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestimonialsController],
      providers: [
        { provide: TestimonialsService, useValue: service },
        {
          provide: AutomationExecutorService,
          useValue: { evaluateTrigger: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    controller = module.get(TestimonialsController);
  });

  it('POST /testimonials — calls create', async () => {
    const dto = { name: 'Alice', content: 'Great!' };
    service.create.mockResolvedValue({ id: 't1', ...dto });

    const result = await controller.create('b1', dto as any);

    expect(service.create).toHaveBeenCalledWith('b1', dto);
    expect(result.id).toBe('t1');
  });

  it('GET /testimonials — calls findAll with query params', async () => {
    service.findAll.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 });

    const result = await controller.findAll(
      'b1',
      'APPROVED',
      undefined,
      undefined,
      undefined,
      '2',
      '10',
    );

    expect(service.findAll).toHaveBeenCalledWith('b1', {
      status: 'APPROVED',
      customerId: undefined,
      search: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      page: 2,
      pageSize: 10,
    });
    expect(result.total).toBe(0);
  });

  it('PATCH /testimonials/:id — calls update', async () => {
    const dto = { content: 'Updated content' };
    service.update.mockResolvedValue({ id: 't1', content: 'Updated content' });

    await controller.update('b1', 't1', dto as any);

    expect(service.update).toHaveBeenCalledWith('b1', 't1', dto);
  });

  it('POST /testimonials/:id/approve — calls approve', async () => {
    service.approve.mockResolvedValue({ id: 't1', status: 'APPROVED' });

    await controller.approve('b1', 't1');

    expect(service.approve).toHaveBeenCalledWith('b1', 't1');
  });

  it('POST /testimonials/:id/reject — calls reject', async () => {
    service.reject.mockResolvedValue({ id: 't1', status: 'REJECTED' });

    await controller.reject('b1', 't1');

    expect(service.reject).toHaveBeenCalledWith('b1', 't1');
  });

  it('POST /testimonials/:id/feature — calls feature', async () => {
    service.feature.mockResolvedValue({ id: 't1', status: 'FEATURED' });

    await controller.feature('b1', 't1');

    expect(service.feature).toHaveBeenCalledWith('b1', 't1');
  });

  it('DELETE /testimonials/:id — calls delete', async () => {
    service.delete.mockResolvedValue({ id: 't1' });

    await controller.delete('b1', 't1');

    expect(service.delete).toHaveBeenCalledWith('b1', 't1');
  });

  it('POST /testimonials/request — calls sendRequest', async () => {
    service.sendRequest.mockResolvedValue({ id: 't1', source: 'REQUESTED' });

    await controller.sendRequest('b1', { customerId: 'c1' });

    expect(service.sendRequest).toHaveBeenCalledWith('b1', 'c1');
  });

  it('GET /testimonials/public/:slug — calls findPublic (no auth)', async () => {
    service.findPublic.mockResolvedValue([{ id: 't1' }]);

    const result = await controller.findPublic('glow-clinic');

    expect(service.findPublic).toHaveBeenCalledWith('glow-clinic');
    expect(result).toHaveLength(1);
  });
});
