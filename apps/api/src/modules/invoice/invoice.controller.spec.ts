import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let service: any;

  const mockInvoice = {
    id: 'inv1',
    businessId: 'biz1',
    invoiceNumber: 'INV-2026-0001',
    status: 'DRAFT',
    total: 100,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockInvoice),
      createFromBooking: jest.fn().mockResolvedValue(mockInvoice),
      createFromQuote: jest.fn().mockResolvedValue(mockInvoice),
      findAll: jest.fn().mockResolvedValue({ data: [mockInvoice], total: 1 }),
      findOne: jest.fn().mockResolvedValue(mockInvoice),
      update: jest.fn().mockResolvedValue(mockInvoice),
      send: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'SENT' }),
      cancel: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'CANCELLED' }),
      recordPayment: jest
        .fn()
        .mockResolvedValue({ payment: { id: 'pay1' }, invoiceStatus: 'PAID' }),
      stats: jest.fn().mockResolvedValue({ totalOutstanding: 500, overdueCount: 2 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [{ provide: InvoiceService, useValue: service }],
    }).compile();

    controller = module.get<InvoiceController>(InvoiceController);
  });

  it('should create an invoice', async () => {
    const result = await controller.create('biz1', {
      customerId: 'cust1',
      lineItems: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
      dueDate: '2026-04-10',
    });
    expect(service.create).toHaveBeenCalledWith('biz1', expect.any(Object));
    expect(result).toEqual(mockInvoice);
  });

  it('should create from booking', async () => {
    const result = await controller.createFromBooking('biz1', 'book1');
    expect(service.createFromBooking).toHaveBeenCalledWith('biz1', 'book1');
    expect(result).toEqual(mockInvoice);
  });

  it('should create from quote', async () => {
    const result = await controller.createFromQuote('biz1', 'q1');
    expect(service.createFromQuote).toHaveBeenCalledWith('biz1', 'q1');
    expect(result).toEqual(mockInvoice);
  });

  it('should list invoices', async () => {
    const result = await controller.findAll('biz1', {});
    expect(service.findAll).toHaveBeenCalledWith('biz1', {});
    expect(result.data).toHaveLength(1);
  });

  it('should get invoice detail', async () => {
    const result = await controller.findOne('biz1', 'inv1');
    expect(service.findOne).toHaveBeenCalledWith('biz1', 'inv1');
    expect(result.id).toBe('inv1');
  });

  it('should update invoice', async () => {
    const result = await controller.update('biz1', 'inv1', { notes: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('biz1', 'inv1', { notes: 'Updated' });
    expect(result).toEqual(mockInvoice);
  });

  it('should send invoice', async () => {
    const result = await controller.send('biz1', 'inv1');
    expect(service.send).toHaveBeenCalledWith('biz1', 'inv1');
    expect(result.status).toBe('SENT');
  });

  it('should cancel invoice', async () => {
    const result = await controller.cancel('biz1', 'inv1');
    expect(service.cancel).toHaveBeenCalledWith('biz1', 'inv1');
    expect(result.status).toBe('CANCELLED');
  });

  it('should record payment', async () => {
    const result = await controller.recordPayment(
      'biz1',
      'inv1',
      {
        amount: 100,
        method: 'CASH',
      },
      { id: 'staff1' },
    );
    expect(service.recordPayment).toHaveBeenCalledWith(
      'biz1',
      'inv1',
      expect.any(Object),
      'staff1',
    );
    expect(result.invoiceStatus).toBe('PAID');
  });

  it('should return stats', async () => {
    const result = await controller.stats('biz1');
    expect(service.stats).toHaveBeenCalledWith('biz1');
    expect(result.totalOutstanding).toBe(500);
  });
});
