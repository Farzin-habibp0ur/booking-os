import { Test, TestingModule } from '@nestjs/testing';
import { AftercareController } from './aftercare.controller';
import { AftercareService } from './aftercare.service';

describe('AftercareController', () => {
  let controller: AftercareController;
  let service: any;

  const mockService = {
    createProtocol: jest.fn(),
    findAllProtocols: jest.fn(),
    findProtocol: jest.fn(),
    updateProtocol: jest.fn(),
    deleteProtocol: jest.fn(),
    findEnrollments: jest.fn(),
    cancelEnrollment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AftercareController],
      providers: [{ provide: AftercareService, useValue: mockService }],
    }).compile();

    controller = module.get(AftercareController);
    service = module.get(AftercareService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createProtocol', () => {
    it('should call service.createProtocol', async () => {
      const dto = { name: 'Test', steps: [] };
      mockService.createProtocol.mockResolvedValue({ id: 'p1', ...dto });

      const result = await controller.createProtocol('biz-1', dto as any);
      expect(service.createProtocol).toHaveBeenCalledWith('biz-1', dto);
      expect(result.id).toBe('p1');
    });
  });

  describe('findAllProtocols', () => {
    it('should call service.findAllProtocols', async () => {
      mockService.findAllProtocols.mockResolvedValue([]);
      await controller.findAllProtocols('biz-1');
      expect(service.findAllProtocols).toHaveBeenCalledWith('biz-1');
    });
  });

  describe('findProtocol', () => {
    it('should call service.findProtocol', async () => {
      mockService.findProtocol.mockResolvedValue({ id: 'p1' });
      await controller.findProtocol('biz-1', 'p1');
      expect(service.findProtocol).toHaveBeenCalledWith('biz-1', 'p1');
    });
  });

  describe('updateProtocol', () => {
    it('should call service.updateProtocol', async () => {
      const dto = { name: 'Updated' };
      mockService.updateProtocol.mockResolvedValue({ id: 'p1', name: 'Updated' });
      await controller.updateProtocol('biz-1', 'p1', dto as any);
      expect(service.updateProtocol).toHaveBeenCalledWith('biz-1', 'p1', dto);
    });
  });

  describe('deleteProtocol', () => {
    it('should call service.deleteProtocol', async () => {
      mockService.deleteProtocol.mockResolvedValue({ id: 'p1' });
      await controller.deleteProtocol('biz-1', 'p1');
      expect(service.deleteProtocol).toHaveBeenCalledWith('biz-1', 'p1');
    });
  });

  describe('findEnrollments', () => {
    it('should call service.findEnrollments with optional customerId', async () => {
      mockService.findEnrollments.mockResolvedValue([]);
      await controller.findEnrollments('biz-1', 'cust-1');
      expect(service.findEnrollments).toHaveBeenCalledWith('biz-1', 'cust-1');
    });
  });

  describe('cancelEnrollment', () => {
    it('should call service.cancelEnrollment', async () => {
      mockService.cancelEnrollment.mockResolvedValue({ id: 'e1', status: 'CANCELLED' });
      await controller.cancelEnrollment('biz-1', 'e1');
      expect(service.cancelEnrollment).toHaveBeenCalledWith('biz-1', 'e1');
    });
  });
});
