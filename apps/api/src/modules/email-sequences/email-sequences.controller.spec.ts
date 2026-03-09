import { Test } from '@nestjs/testing';
import { EmailSequenceController } from './email-sequences.controller';
import { EmailSequenceService } from './email-sequences.service';

describe('EmailSequenceController', () => {
  let controller: EmailSequenceController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    createSequence: jest.Mock;
    updateSequence: jest.Mock;
    deleteSequence: jest.Mock;
    getStats: jest.Mock;
    enroll: jest.Mock;
    getEnrollments: jest.Mock;
    cancelEnrollment: jest.Mock;
    pauseEnrollment: jest.Mock;
    resumeEnrollment: jest.Mock;
    seedDefaultSequences: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'seq1' }),
      createSequence: jest.fn().mockResolvedValue({ id: 'seq1' }),
      updateSequence: jest.fn().mockResolvedValue({ id: 'seq1' }),
      deleteSequence: jest.fn().mockResolvedValue({ id: 'seq1', isActive: false }),
      getStats: jest.fn().mockResolvedValue({ totalEnrolled: 0 }),
      enroll: jest.fn().mockResolvedValue({ id: 'enr1' }),
      getEnrollments: jest.fn().mockResolvedValue([]),
      cancelEnrollment: jest.fn().mockResolvedValue({ id: 'enr1', status: 'CANCELLED' }),
      pauseEnrollment: jest.fn().mockResolvedValue({ id: 'enr1', status: 'PAUSED' }),
      resumeEnrollment: jest.fn().mockResolvedValue({ id: 'enr1', status: 'ACTIVE' }),
      seedDefaultSequences: jest.fn().mockResolvedValue(7),
    };

    const module = await Test.createTestingModule({
      controllers: [EmailSequenceController],
      providers: [{ provide: EmailSequenceService, useValue: service }],
    }).compile();

    controller = module.get(EmailSequenceController);
  });

  it('findAll calls service', async () => {
    await controller.findAll('biz1', {});
    expect(service.findAll).toHaveBeenCalledWith('biz1', {});
  });

  it('getStats calls service', async () => {
    await controller.getStats('biz1');
    expect(service.getStats).toHaveBeenCalledWith('biz1');
  });

  it('create calls service', async () => {
    const dto = { name: 'Test', type: 'CUSTOM', steps: [] };
    await controller.create('biz1', dto as any);
    expect(service.createSequence).toHaveBeenCalledWith('biz1', dto);
  });

  it('findOne calls service', async () => {
    await controller.findOne('biz1', 'seq1');
    expect(service.findOne).toHaveBeenCalledWith('biz1', 'seq1');
  });

  it('update calls service', async () => {
    await controller.update('biz1', 'seq1', { name: 'Updated' });
    expect(service.updateSequence).toHaveBeenCalledWith('biz1', 'seq1', { name: 'Updated' });
  });

  it('remove calls service', async () => {
    await controller.remove('biz1', 'seq1');
    expect(service.deleteSequence).toHaveBeenCalledWith('biz1', 'seq1');
  });

  it('enroll calls service', async () => {
    const dto = { email: 'user@test.com', name: 'Sarah' };
    await controller.enroll('biz1', 'seq1', dto as any);
    expect(service.enroll).toHaveBeenCalledWith('biz1', 'seq1', dto);
  });

  it('getEnrollments calls service', async () => {
    await controller.getEnrollments('biz1', 'seq1', {});
    expect(service.getEnrollments).toHaveBeenCalledWith('biz1', 'seq1', {});
  });

  it('cancelEnrollment calls service', async () => {
    await controller.cancelEnrollment('biz1', 'enr1');
    expect(service.cancelEnrollment).toHaveBeenCalledWith('biz1', 'enr1');
  });

  it('pauseEnrollment calls service', async () => {
    await controller.pauseEnrollment('biz1', 'enr1');
    expect(service.pauseEnrollment).toHaveBeenCalledWith('biz1', 'enr1');
  });

  it('resumeEnrollment calls service', async () => {
    await controller.resumeEnrollment('biz1', 'enr1');
    expect(service.resumeEnrollment).toHaveBeenCalledWith('biz1', 'enr1');
  });

  it('seed calls service', async () => {
    await controller.seed();
    expect(service.seedDefaultSequences).toHaveBeenCalled();
  });
});
