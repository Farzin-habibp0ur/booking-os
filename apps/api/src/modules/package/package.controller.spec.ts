import { Test, TestingModule } from '@nestjs/testing';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

describe('PackageController', () => {
  let controller: PackageController;
  let service: any;

  const businessId = 'biz-1';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      purchase: jest.fn(),
      listPurchases: jest.fn(),
      getPurchase: jest.fn(),
      redeem: jest.fn(),
      getCustomerActivePackages: jest.fn(),
      stats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageController],
      providers: [{ provide: PackageService, useValue: service }],
    }).compile();

    controller = module.get<PackageController>(PackageController);
  });

  it('should create a package', async () => {
    const dto = { name: '10 Sessions', totalSessions: 10, price: 250 };
    service.create.mockResolvedValue({ id: 'pkg-1', ...dto });

    const result = await controller.create(businessId, dto);
    expect(result.name).toBe('10 Sessions');
    expect(service.create).toHaveBeenCalledWith(businessId, dto);
  });

  it('should list packages', async () => {
    service.findAll.mockResolvedValue([{ id: 'pkg-1' }]);
    const result = await controller.findAll(businessId);
    expect(result).toHaveLength(1);
  });

  it('should get stats', async () => {
    service.stats.mockResolvedValue({ totalPackages: 5 });
    const result = await controller.stats(businessId);
    expect(result.totalPackages).toBe(5);
  });

  it('should get package by id', async () => {
    service.findOne.mockResolvedValue({ id: 'pkg-1' });
    const result = await controller.findOne(businessId, 'pkg-1');
    expect(result.id).toBe('pkg-1');
  });

  it('should update package', async () => {
    service.update.mockResolvedValue({ id: 'pkg-1', name: 'Updated' });
    const result = await controller.update(businessId, 'pkg-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('should delete package', async () => {
    service.delete.mockResolvedValue({ id: 'pkg-1' });
    await controller.delete(businessId, 'pkg-1');
    expect(service.delete).toHaveBeenCalledWith(businessId, 'pkg-1');
  });

  it('should purchase package', async () => {
    service.purchase.mockResolvedValue({ id: 'pur-1', totalSessions: 10 });
    const result = await controller.purchase(businessId, 'pkg-1', { customerId: 'cust-1' });
    expect(result.totalSessions).toBe(10);
  });

  it('should list purchases', async () => {
    service.listPurchases.mockResolvedValue([{ id: 'pur-1' }]);
    const result = await controller.listPurchases(businessId, 'cust-1', 'ACTIVE');
    expect(result).toHaveLength(1);
    expect(service.listPurchases).toHaveBeenCalledWith(businessId, 'cust-1', 'ACTIVE');
  });

  it('should get purchase detail', async () => {
    service.getPurchase.mockResolvedValue({ id: 'pur-1', redemptions: [] });
    const result = await controller.getPurchase(businessId, 'pur-1');
    expect(result.id).toBe('pur-1');
  });

  it('should redeem session', async () => {
    service.redeem.mockResolvedValue({ usedSessions: 3, remaining: 7 });
    const result = await controller.redeem(businessId, 'pur-1', { bookingId: 'book-1' });
    expect(result.remaining).toBe(7);
  });

  it('should get active packages for customer', async () => {
    service.getCustomerActivePackages.mockResolvedValue([{ id: 'pur-1' }]);
    const result = await controller.getCustomerActivePackages(businessId, 'cust-1', 'svc-1');
    expect(result).toHaveLength(1);
    expect(service.getCustomerActivePackages).toHaveBeenCalledWith(businessId, 'cust-1', 'svc-1');
  });
});
