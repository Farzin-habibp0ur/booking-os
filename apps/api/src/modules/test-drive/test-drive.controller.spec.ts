import { Test } from '@nestjs/testing';
import { TestDriveController } from './test-drive.controller';
import { TestDriveService } from './test-drive.service';

describe('TestDriveController', () => {
  let controller: TestDriveController;
  let service: any;

  const businessId = 'biz-1';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [TestDriveController],
      providers: [{ provide: TestDriveService, useValue: service }],
    }).compile();

    controller = module.get(TestDriveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() calls service.create', async () => {
    service.create.mockResolvedValue({ id: 'td-1' });
    const body = { vehicleId: 'veh-1', customerId: 'cust-1', startTime: '2026-04-01T10:00:00Z' };

    await controller.create(businessId, body);
    expect(service.create).toHaveBeenCalledWith(businessId, body);
  });

  it('update() calls service.update', async () => {
    service.update.mockResolvedValue({ id: 'td-1', status: 'COMPLETED' });

    await controller.update(businessId, 'td-1', { status: 'COMPLETED' });
    expect(service.update).toHaveBeenCalledWith(businessId, 'td-1', { status: 'COMPLETED' });
  });

  it('findAll() calls service.findAll with filters', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll(businessId, 'veh-1', undefined);
    expect(service.findAll).toHaveBeenCalledWith(businessId, {
      vehicleId: 'veh-1',
      customerId: undefined,
    });
  });
});
