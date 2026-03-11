import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';

describe('MedicalRecordController', () => {
  let controller: MedicalRecordController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'mr1', version: 1, flagged: true }),
      getCurrent: jest.fn().mockResolvedValue({ id: 'mr1', version: 1 }),
      getHistory: jest.fn().mockResolvedValue([{ id: 'mr1', version: 2 }, { id: 'mr0', version: 1 }]),
    };

    const module = await Test.createTestingModule({
      controllers: [MedicalRecordController],
      providers: [
        { provide: MedicalRecordService, useValue: service },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    controller = module.get(MedicalRecordController);
  });

  it('POST /medical-records calls service.create with correct params', async () => {
    const dto = { customerId: 'c1', allergies: ['latex'], bloodThinners: true };
    const req = { user: { staffId: 'staff1' } };
    const result = await controller.create('biz1', dto as any, req);

    expect(service.create).toHaveBeenCalledWith('biz1', dto, 'staff1');
    expect(result.id).toBe('mr1');
  });

  it('GET /medical-records returns current record', async () => {
    const result = await controller.getCurrent('biz1', 'c1');

    expect(service.getCurrent).toHaveBeenCalledWith('biz1', 'c1');
    expect(result!.id).toBe('mr1');
  });

  it('GET /medical-records throws BadRequestException without customerId', async () => {
    await expect(controller.getCurrent('biz1', '')).rejects.toThrow(BadRequestException);
  });

  it('GET /medical-records/:id/history returns version history', async () => {
    const result = await controller.getHistory('biz1', 'mr1');

    expect(service.getHistory).toHaveBeenCalledWith('biz1', 'mr1');
    expect(result).toHaveLength(2);
  });
});
