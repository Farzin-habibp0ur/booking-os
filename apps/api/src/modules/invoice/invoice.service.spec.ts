import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../common/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: any;

  const mockBusiness = { id: 'biz1', name: 'Test Business' };
  const mockCustomer = { id: 'cust1', businessId: 'biz1', name: 'John Doe', email: 'john@test.com' };
  const mockBooking = {
    id: 'book1',
    businessId: 'biz1',
    customerId: 'cust1',
    serviceId: 'svc1',
    service: { id: 'svc1', name: 'Haircut', price: 50 },
    customer: mockCustomer,
  };

  const mockInvoice = {
    id: 'inv1',
    businessId: 'biz1',
    customerId: 'cust1',
    invoiceNumber: 'INV-2026-0001',
    status: 'DRAFT',
    subtotal: 50,
    taxRate: null,
    taxAmount: null,
    discountAmount: null,
    total: 50,
    paidAmount: 0,
    dueDate: new Date('2026-04-10'),
    createdAt: new Date(),
    lineItems: [{ id: 'li1', description: 'Haircut', quantity: 1, unitPrice: 50, total: 50 }],
    customer: mockCustomer,
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        create: jest.fn().mockResolvedValue(mockInvoice),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([mockInvoice]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'SENT' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0, paidAmount: 0 }, _count: { id: 0 } }),
      },
      invoiceLineItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue(mockCustomer),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(mockBooking),
      },
      quote: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay1', amount: 50 }),
      },
      $transaction: jest.fn().mockImplementation(async (arr) => {
        const results = [];
        for (const p of arr) results.push(await p);
        return results;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('create', () => {
    it('should create an invoice with line items', async () => {
      const result = await service.create('biz1', {
        customerId: 'cust1',
        lineItems: [{ description: 'Haircut', quantity: 1, unitPrice: 50 }],
        dueDate: '2026-04-10T00:00:00Z',
      });

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            customerId: 'cust1',
            subtotal: 50,
            total: 50,
          }),
        }),
      );
      expect(result).toEqual(mockInvoice);
    });

    it('should throw if customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.create('biz1', {
          customerId: 'nonexistent',
          lineItems: [{ description: 'Test', quantity: 1, unitPrice: 10 }],
          dueDate: '2026-04-10T00:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should compute tax and discount correctly', async () => {
      await service.create('biz1', {
        customerId: 'cust1',
        lineItems: [{ description: 'Service', quantity: 2, unitPrice: 100 }],
        taxRate: 0.1,
        discountAmount: 20,
        dueDate: '2026-04-10T00:00:00Z',
      });

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 200,
            taxRate: 0.1,
            taxAmount: 18, // (200 - 20) * 0.1
            total: 198, // 200 - 20 + 18
          }),
        }),
      );
    });

    it('should reject duplicate quote invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(
        service.create('biz1', {
          customerId: 'cust1',
          quoteId: 'q1',
          lineItems: [{ description: 'Test', quantity: 1, unitPrice: 10 }],
          dueDate: '2026-04-10T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createFromBooking', () => {
    it('should create invoice from booking service data', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await service.createFromBooking('biz1', 'book1');

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            customerId: 'cust1',
            bookingId: 'book1',
          }),
        }),
      );
    });

    it('should return existing invoice if booking already has one', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.createFromBooking('biz1', 'book1');
      expect(result).toEqual(mockInvoice);
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it('should throw if booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.createFromBooking('biz1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      const result = await service.findAll('biz1', {});

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({ data: [mockInvoice], total: 1 });
    });

    it('should filter by status', async () => {
      await service.findAll('biz1', { status: 'PAID' });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'PAID' },
        }),
      );
    });

    it('should filter by date range', async () => {
      await service.findAll('biz1', { from: '2026-01-01', to: '2026-12-31' });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return invoice with all relations', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.findOne('biz1', 'inv1');
      expect(result).toEqual(mockInvoice);
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv1', businessId: 'biz1' },
        }),
      );
    });

    it('should throw if not found', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await service.update('biz1', 'inv1', { notes: 'Updated' });

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv1' },
          data: expect.objectContaining({ notes: 'Updated' }),
        }),
      );
    });

    it('should reject editing non-draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, status: 'SENT' });

      await expect(
        service.update('biz1', 'inv1', { notes: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('send', () => {
    it('should mark invoice as sent', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await service.send('biz1', 'inv1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('should reject sending non-draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, status: 'PAID' });

      await expect(service.send('biz1', 'inv1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordPayment', () => {
    it('should record payment and update invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: 'SENT',
        total: 100,
        paidAmount: 0,
      });

      const result = await service.recordPayment('biz1', 'inv1', {
        amount: 100,
        method: 'CASH',
      }, 'staff1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.invoiceStatus).toBe('PAID');
      expect(result.remaining).toBe(0);
    });

    it('should handle partial payment', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: 'SENT',
        total: 100,
        paidAmount: 0,
      });

      const result = await service.recordPayment('biz1', 'inv1', {
        amount: 50,
        method: 'CARD',
      }, 'staff1');

      expect(result.invoiceStatus).toBe('PARTIALLY_PAID');
      expect(result.remaining).toBe(50);
    });

    it('should reject payment exceeding balance', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: 'SENT',
        total: 50,
        paidAmount: 40,
      });

      await expect(
        service.recordPayment('biz1', 'inv1', { amount: 20, method: 'CASH' }, 'staff1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment for draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(
        service.recordPayment('biz1', 'inv1', { amount: 10, method: 'CASH' }, 'staff1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await service.cancel('biz1', 'inv1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        }),
      );
    });

    it('should reject cancelling a paid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, status: 'PAID' });

      await expect(service.cancel('biz1', 'inv1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('stats', () => {
    it('should return invoice statistics', async () => {
      prisma.invoice.aggregate.mockResolvedValue({
        _sum: { total: 1000, paidAmount: 200 },
        _count: { id: 5 },
      });
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.stats('biz1');

      expect(result).toHaveProperty('totalOutstanding');
      expect(result).toHaveProperty('overdueCount');
      expect(result).toHaveProperty('revenueThisMonth');
      expect(result).toHaveProperty('avgDaysToPay');
    });
  });

  describe('checkOverdueInvoices', () => {
    it('should mark overdue invoices', async () => {
      await service.checkOverdueInvoices();

      expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
          }),
          data: { status: 'OVERDUE' },
        }),
      );
    });
  });

  describe('getCustomerInvoices', () => {
    it('should return non-draft invoices for a customer', async () => {
      await service.getCustomerInvoices('cust1', 'biz1');

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust1', businessId: 'biz1', status: { not: 'DRAFT' } },
        }),
      );
    });
  });
});
