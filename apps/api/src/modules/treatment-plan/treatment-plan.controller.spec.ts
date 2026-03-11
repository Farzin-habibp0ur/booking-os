import { Test, TestingModule } from '@nestjs/testing';
import { TreatmentPlanController } from './treatment-plan.controller';
import { TreatmentPlanService } from './treatment-plan.service';

describe('TreatmentPlanController', () => {
  let controller: TreatmentPlanController;
  let service: any;

  const businessId = 'biz-1';
  const user = { id: 'staff-1', businessId };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'DRAFT' }),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      update: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'DRAFT' }),
      addSession: jest.fn().mockResolvedValue({ id: 'sess-1' }),
      updateSession: jest.fn().mockResolvedValue({ id: 'sess-1' }),
      propose: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'PROPOSED' }),
      accept: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'ACCEPTED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TreatmentPlanController],
      providers: [{ provide: TreatmentPlanService, useValue: service }],
    }).compile();

    controller = module.get<TreatmentPlanController>(TreatmentPlanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create calls service.create', async () => {
    const dto = { consultBookingId: 'b-1', diagnosis: 'test' };
    await controller.create(businessId, user, dto as any);
    expect(service.create).toHaveBeenCalledWith(businessId, 'staff-1', dto);
  });

  it('findAll calls service.findAll', async () => {
    await controller.findAll(businessId, 'cust-1');
    expect(service.findAll).toHaveBeenCalledWith(businessId, 'cust-1');
  });

  it('findOne calls service.findOne', async () => {
    await controller.findOne(businessId, 'plan-1');
    expect(service.findOne).toHaveBeenCalledWith(businessId, 'plan-1');
  });

  it('update calls service.update', async () => {
    const dto = { diagnosis: 'updated' };
    await controller.update(businessId, 'plan-1', dto as any);
    expect(service.update).toHaveBeenCalledWith(businessId, 'plan-1', dto);
  });

  it('addSession calls service.addSession', async () => {
    const dto = { serviceId: 'svc-1', sequenceOrder: 1 };
    await controller.addSession(businessId, 'plan-1', dto as any);
    expect(service.addSession).toHaveBeenCalledWith(businessId, 'plan-1', dto);
  });

  it('updateSession calls service.updateSession', async () => {
    const dto = { status: 'COMPLETED' };
    await controller.updateSession(businessId, 'plan-1', 'sess-1', dto as any);
    expect(service.updateSession).toHaveBeenCalledWith(businessId, 'plan-1', 'sess-1', dto);
  });

  it('propose calls service.propose', async () => {
    await controller.propose(businessId, 'plan-1');
    expect(service.propose).toHaveBeenCalledWith(businessId, 'plan-1');
  });

  it('accept calls service.accept', async () => {
    await controller.accept(businessId, 'plan-1');
    expect(service.accept).toHaveBeenCalledWith(businessId, 'plan-1');
  });
});
