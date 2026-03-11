import { Test } from '@nestjs/testing';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

describe('VehicleController', () => {
  let controller: VehicleController;
  let service: any;

  const businessId = 'biz-1';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      stats: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [VehicleController],
      providers: [{ provide: VehicleService, useValue: service }],
    }).compile();

    controller = module.get(VehicleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() calls service.create with staffId', async () => {
    service.create.mockResolvedValue({ id: 'veh-1' });
    const body = { year: 2024, make: 'Toyota', model: 'Camry' };
    const user = { id: 'staff-1' };

    await controller.create(businessId, body, user);
    expect(service.create).toHaveBeenCalledWith(businessId, body, 'staff-1');
  });

  it('findAll() calls service.findAll', async () => {
    service.findAll.mockResolvedValue({ data: [], total: 0 });
    const query = { status: 'IN_STOCK' };

    await controller.findAll(businessId, query);
    expect(service.findAll).toHaveBeenCalledWith(businessId, query);
  });

  it('findOne() calls service.findOne', async () => {
    service.findOne.mockResolvedValue({ id: 'veh-1' });

    await controller.findOne(businessId, 'veh-1');
    expect(service.findOne).toHaveBeenCalledWith(businessId, 'veh-1');
  });

  it('update() calls service.update', async () => {
    service.update.mockResolvedValue({ id: 'veh-1' });

    await controller.update(businessId, 'veh-1', { color: 'Red' });
    expect(service.update).toHaveBeenCalledWith(businessId, 'veh-1', { color: 'Red' });
  });

  it('remove() calls service.remove', async () => {
    service.remove.mockResolvedValue({ id: 'veh-1' });

    await controller.remove(businessId, 'veh-1');
    expect(service.remove).toHaveBeenCalledWith(businessId, 'veh-1');
  });

  it('stats() calls service.stats', async () => {
    service.stats.mockResolvedValue({ total: 5 });

    await controller.stats(businessId);
    expect(service.stats).toHaveBeenCalledWith(businessId);
  });
});
