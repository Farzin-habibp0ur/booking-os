import { Test, TestingModule } from '@nestjs/testing';
import { RecurringClassController } from './recurring-class.controller';
import { RecurringClassService } from './recurring-class.service';

describe('RecurringClassController', () => {
  let controller: RecurringClassController;
  let service: any;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getWeeklySchedule: jest.fn(),
    enroll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecurringClassController],
      providers: [{ provide: RecurringClassService, useValue: mockService }],
    }).compile();

    controller = module.get(RecurringClassController);
    service = module.get(RecurringClassService);
  });

  const bizId = 'biz-1';

  it('create calls service.create', async () => {
    const dto = { serviceId: 'svc-1', staffId: 'staff-1', dayOfWeek: 1, startTime: '09:00', maxParticipants: 10 };
    service.create.mockResolvedValue({ id: 'rc-1' });
    const result = await controller.create(bizId, dto);
    expect(service.create).toHaveBeenCalledWith(bizId, dto);
    expect(result.id).toBe('rc-1');
  });

  it('findAll calls service.findAll', async () => {
    service.findAll.mockResolvedValue([{ id: 'rc-1' }]);
    const result = await controller.findAll(bizId);
    expect(result).toHaveLength(1);
  });

  it('findOne calls service.findOne', async () => {
    service.findOne.mockResolvedValue({ id: 'rc-1' });
    const result = await controller.findOne(bizId, 'rc-1');
    expect(result.id).toBe('rc-1');
  });

  it('update calls service.update', async () => {
    service.update.mockResolvedValue({ id: 'rc-1', maxParticipants: 20 });
    const result = await controller.update(bizId, 'rc-1', { maxParticipants: 20 });
    expect(result.maxParticipants).toBe(20);
  });

  it('remove calls service.remove', async () => {
    service.remove.mockResolvedValue({ id: 'rc-1' });
    const result = await controller.remove(bizId, 'rc-1');
    expect(result.id).toBe('rc-1');
  });

  it('getSchedule calls service.getWeeklySchedule', async () => {
    service.getWeeklySchedule.mockResolvedValue([{ id: 'rc-1', enrollmentCount: 5 }]);
    const result = await controller.getSchedule(bizId, '2026-W12');
    expect(service.getWeeklySchedule).toHaveBeenCalledWith(bizId, '2026-W12');
    expect(result[0].enrollmentCount).toBe(5);
  });

  it('enroll calls service.enroll', async () => {
    service.enroll.mockResolvedValue({ id: 'bk-1', status: 'CONFIRMED' });
    const result = await controller.enroll(bizId, 'rc-1', 'cust-1');
    expect(service.enroll).toHaveBeenCalledWith(bizId, 'rc-1', 'cust-1');
    expect(result.status).toBe('CONFIRMED');
  });
});
