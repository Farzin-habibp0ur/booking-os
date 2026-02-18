import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { NotificationService } from '../notification/notification.service';
import { BookingService } from '../booking/booking.service';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private notificationService: NotificationService,
    private bookingService: BookingService,
    private configService: ConfigService,
  ) {}

  async create(
    businessId: string,
    data: {
      bookingId: string;
      description: string;
      totalAmount: number;
      pdfUrl?: string;
    },
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: data.bookingId, businessId },
      include: { customer: true, service: true, staff: true, business: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // Create the quote
    const quote = await this.prisma.quote.create({
      data: {
        bookingId: data.bookingId,
        businessId,
        description: data.description,
        totalAmount: data.totalAmount,
        pdfUrl: data.pdfUrl || null,
        status: 'PENDING',
      },
    });

    // Create approval token (48h expiry)
    const token = await this.tokenService.createToken(
      'QUOTE_APPROVAL',
      booking.customer.email || booking.customer.phone,
      businessId,
      undefined,
      48,
      data.bookingId,
    );

    // Store token reference on quote
    await this.prisma.quote.update({
      where: { id: quote.id },
      data: { tokenId: token },
    });

    // Move kanban status to AWAITING_APPROVAL
    await this.bookingService.updateKanbanStatus(businessId, data.bookingId, 'AWAITING_APPROVAL');

    // Send notification with approval link
    const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');
    const approvalLink = `${webUrl}/manage/quote/${token}`;

    this.notificationService
      .sendQuoteApprovalRequest(booking as any, quote.totalAmount, quote.description, approvalLink)
      .catch((err) =>
        this.logger.warn(`Failed to send quote approval notification for quote ${quote.id}`, {
          quoteId: quote.id,
          bookingId: data.bookingId,
          error: err.message,
        }),
      );

    this.logger.log(`Quote created: quote=${quote.id} booking=${data.bookingId}`);

    return { ...quote, approvalLink };
  }

  async findById(businessId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, businessId },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            service: { select: { id: true, name: true } },
            staff: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async findByBooking(businessId: string, bookingId: string) {
    return this.prisma.quote.findMany({
      where: { bookingId, businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuoteForApproval(token: string) {
    const record = await this.tokenService.validateToken(token, 'QUOTE_APPROVAL');

    if (!record.bookingId) {
      throw new BadRequestException('Invalid token');
    }

    const quote = await this.prisma.quote.findFirst({
      where: {
        bookingId: record.bookingId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!quote) throw new NotFoundException('Quote not found or already processed');

    const booking = await this.prisma.booking.findFirst({
      where: { id: record.bookingId },
      include: {
        customer: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMins: true } },
        staff: { select: { id: true, name: true } },
        business: { select: { id: true, name: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    return {
      quote: {
        id: quote.id,
        description: quote.description,
        totalAmount: quote.totalAmount,
        pdfUrl: quote.pdfUrl,
        status: quote.status,
        createdAt: quote.createdAt,
      },
      booking: {
        id: booking.id,
        service: booking.service,
        staff: booking.staff,
        customer: { name: booking.customer.name },
      },
      business: booking.business,
    };
  }

  async approveQuote(token: string, approverIp?: string) {
    const record = await this.tokenService.validateToken(token, 'QUOTE_APPROVAL');

    if (!record.bookingId) {
      throw new BadRequestException('Invalid token');
    }

    const quote = await this.prisma.quote.findFirst({
      where: {
        bookingId: record.bookingId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!quote) throw new NotFoundException('Quote not found or already processed');

    // Mark token used before executing to prevent concurrent reuse
    await this.tokenService.markUsed(record.id);

    // Approve the quote
    const updated = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approverIp: approverIp || null,
      },
    });

    // Move kanban status to IN_PROGRESS
    const booking = await this.prisma.booking.findFirst({
      where: { id: record.bookingId },
      include: { customer: true, service: true, staff: true, business: true },
    });

    if (booking) {
      await this.bookingService.updateKanbanStatus(booking.businessId, booking.id, 'IN_PROGRESS');
    }

    this.logger.log(`Quote approved: quote=${quote.id} booking=${record.bookingId}`);

    return updated;
  }
}
