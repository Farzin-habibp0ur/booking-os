import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesDto, RecordPaymentDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  private async generateInvoiceNumber(businessId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const latest = await this.prisma.invoice.findFirst({
      where: { businessId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let seq = 1;
    if (latest) {
      const lastSeq = parseInt(latest.invoiceNumber.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private computeTotals(
    lineItems: { quantity: number; unitPrice: number }[],
    taxRate?: number,
    discountAmount?: number,
  ) {
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const discount = discountAmount || 0;
    const taxable = subtotal - discount;
    const taxAmt = taxRate ? Math.round(taxable * taxRate * 100) / 100 : 0;
    const total = Math.round((taxable + taxAmt) * 100) / 100;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: taxAmt || undefined,
      total,
    };
  }

  async create(businessId: string, data: CreateInvoiceDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (data.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: data.bookingId, businessId },
      });
      if (!booking) throw new NotFoundException('Booking not found');
    }

    if (data.quoteId) {
      const existing = await this.prisma.invoice.findFirst({ where: { quoteId: data.quoteId } });
      if (existing) throw new BadRequestException('Invoice already exists for this quote');
    }

    const invoiceNumber = await this.generateInvoiceNumber(businessId);
    const { subtotal, taxAmount, total } = this.computeTotals(
      data.lineItems,
      data.taxRate,
      data.discountAmount,
    );

    return this.prisma.invoice.create({
      data: {
        businessId,
        customerId: data.customerId,
        bookingId: data.bookingId,
        quoteId: data.quoteId,
        invoiceNumber,
        subtotal,
        taxRate: data.taxRate,
        taxAmount,
        discountAmount: data.discountAmount,
        total,
        currency: data.currency || 'USD',
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        terms: data.terms,
        lineItems: {
          create: data.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            total: Math.round(li.quantity * li.unitPrice * 100) / 100,
            serviceId: li.serviceId,
          })),
        },
      },
      include: { lineItems: true, customer: true, booking: true },
    });
  }

  async createFromBooking(businessId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: { service: true, customer: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.prisma.invoice.findFirst({
      where: { bookingId, businessId },
    });
    if (existing) return existing;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return this.create(businessId, {
      customerId: booking.customerId,
      bookingId,
      lineItems: [
        {
          description: booking.service.name,
          quantity: 1,
          unitPrice: booking.service.price,
          serviceId: booking.serviceId,
        },
      ],
      dueDate: dueDate.toISOString(),
    });
  }

  async createFromQuote(businessId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, businessId },
      include: { booking: { include: { service: true, customer: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return this.create(businessId, {
      customerId: quote.booking.customerId,
      bookingId: quote.bookingId,
      quoteId,
      lineItems: [
        {
          description: quote.description,
          quantity: 1,
          unitPrice: quote.totalAmount,
        },
      ],
      dueDate: dueDate.toISOString(),
    });
  }

  async findAll(businessId: string, query: ListInvoicesDto) {
    const where: any = { businessId };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, lineItems: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        booking: { include: { service: true, staff: true } },
        quote: true,
        lineItems: { include: { service: true } },
        payments: true,
        business: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async update(businessId: string, id: string, data: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    const updateData: any = {};
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.terms !== undefined) updateData.terms = data.terms;
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

    if (data.lineItems) {
      const { subtotal, taxAmount, total } = this.computeTotals(
        data.lineItems,
        data.taxRate ?? (invoice.taxRate ? Number(invoice.taxRate) : undefined),
        data.discountAmount ??
          (invoice.discountAmount ? Number(invoice.discountAmount) : undefined),
      );
      updateData.subtotal = subtotal;
      updateData.taxAmount = taxAmount;
      updateData.total = total;

      await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      updateData.lineItems = {
        create: data.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: Math.round(li.quantity * li.unitPrice * 100) / 100,
          serviceId: li.serviceId,
        })),
      };
    }

    if (data.taxRate !== undefined) {
      updateData.taxRate = data.taxRate;
      if (!data.lineItems) {
        const currentItems = await this.prisma.invoiceLineItem.findMany({
          where: { invoiceId: id },
        });
        const items = currentItems.map((li) => ({
          quantity: li.quantity,
          unitPrice: Number(li.unitPrice),
        }));
        const recalc = this.computeTotals(
          items,
          data.taxRate,
          data.discountAmount ??
            (invoice.discountAmount ? Number(invoice.discountAmount) : undefined),
        );
        updateData.subtotal = recalc.subtotal;
        updateData.taxAmount = recalc.taxAmount;
        updateData.total = recalc.total;
      }
    }

    if (data.discountAmount !== undefined) {
      updateData.discountAmount = data.discountAmount;
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { lineItems: true, customer: true },
    });
  }

  async send(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT' && invoice.status !== 'OVERDUE') {
      throw new BadRequestException('Invoice cannot be sent in its current status');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: { customer: true, lineItems: true },
    });
  }

  async markViewed(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.viewedAt) return invoice;

    return this.prisma.invoice.update({
      where: { id },
      data: { status: invoice.status === 'SENT' ? 'VIEWED' : invoice.status, viewedAt: new Date() },
    });
  }

  async recordPayment(
    businessId: string,
    id: string,
    data: RecordPaymentDto,
    recordedById: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: { customer: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const allowedStatuses = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'];
    if (!allowedStatuses.includes(invoice.status)) {
      throw new BadRequestException('Cannot record payment for this invoice');
    }

    const currentPaid = Number(invoice.paidAmount);
    const totalDue = Number(invoice.total);
    const maxPayable = Math.round((totalDue - currentPaid) * 100) / 100;

    if (data.amount > maxPayable) {
      throw new BadRequestException(`Payment exceeds remaining balance of ${maxPayable}`);
    }

    const newPaidAmount = Math.round((currentPaid + data.amount) * 100) / 100;
    const fullyPaid = newPaidAmount >= totalDue;

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          businessId,
          invoiceId: id,
          customerId: invoice.customerId,
          bookingId: invoice.bookingId,
          amount: data.amount,
          method: data.method,
          reference: data.reference,
          notes: data.notes,
          recordedById,
          status: 'COMPLETED',
        },
      }),
      this.prisma.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          ...(fullyPaid ? { paidAt: new Date() } : {}),
        },
      }),
    ]);

    return {
      payment,
      invoiceStatus: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
      paidAmount: newPaidAmount,
      remaining: Math.round((totalDue - newPaidAmount) * 100) / 100,
    };
  }

  async stats(businessId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [outstanding, overdue, paidThisMonth, allPaid] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          businessId,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { total: true, paidAmount: true },
        _count: { id: true },
      }),
      this.prisma.invoice.aggregate({
        where: { businessId, status: 'OVERDUE' },
        _sum: { total: true, paidAmount: true },
        _count: { id: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          businessId,
          status: 'PAID',
          paidAt: { gte: startOfMonth },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.invoice.findMany({
        where: { businessId, status: 'PAID', paidAt: { not: null }, sentAt: { not: null } },
        select: { sentAt: true, paidAt: true },
      }),
    ]);

    const totalOutstanding =
      Number(outstanding._sum.total || 0) - Number(outstanding._sum.paidAmount || 0);
    const overdueAmount = Number(overdue._sum.total || 0) - Number(overdue._sum.paidAmount || 0);

    let avgDaysToPay = 0;
    if (allPaid.length > 0) {
      const totalDays = allPaid.reduce((sum, inv) => {
        const diff = (inv.paidAt!.getTime() - inv.sentAt!.getTime()) / (1000 * 60 * 60 * 24);
        return sum + diff;
      }, 0);
      avgDaysToPay = Math.round(totalDays / allPaid.length);
    }

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      outstandingCount: outstanding._count.id,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      overdueCount: overdue._count.id,
      revenueThisMonth: Number(paidThisMonth._sum.total || 0),
      paidThisMonthCount: paidThisMonth._count.id,
      avgDaysToPay,
    };
  }

  async cancel(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot cancel this invoice');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkOverdueInvoices() {
    const now = new Date();
    await this.prisma.invoice.updateMany({
      where: {
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
  }

  async getCustomerInvoices(customerId: string, businessId: string) {
    return this.prisma.invoice.findMany({
      where: { customerId, businessId, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true },
    });
  }
}
