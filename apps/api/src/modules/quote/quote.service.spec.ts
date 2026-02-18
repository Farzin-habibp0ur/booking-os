import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuoteService } from './quote.service';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { NotificationService } from '../notification/notification.service';
import { BookingService } from '../booking/booking.service';
import {
  createMockPrisma,
  createMockTokenService,
  createMockNotificationService,
  createMockConfigService,
} from '../../test/mocks';

describe('QuoteService', () => {
  let service: QuoteService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockTokenService: ReturnType<typeof createMockTokenService>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockBookingService: any;
  let mockConfigService: ReturnType<typeof createMockConfigService>;

  const mockBooking = {
    id: 'b1',
    businessId: 'biz1',
    status: 'CONFIRMED',
    kanbanStatus: 'DIAGNOSING',
    customer: { id: 'c1', name: 'John Smith', phone: '+1234567890', email: 'john@test.com' },
    service: { id: 's1', name: 'Brake Service', durationMins: 90, price: 250 },
    staff: { id: 'st1', name: 'Mike M.' },
    business: { id: 'biz1', name: 'Metro Auto Group' },
    startTime: new Date('2026-02-17T10:00:00Z'),
    endTime: new Date('2026-02-17T11:30:00Z'),
  };

  const mockQuote = {
    id: 'q1',
    bookingId: 'b1',
    businessId: 'biz1',
    description: 'Replace front brake pads and rotors',
    totalAmount: 450,
    pdfUrl: null,
    status: 'PENDING',
    approvedAt: null,
    approverIp: null,
    tokenId: null,
    createdAt: new Date('2026-02-17T12:00:00Z'),
    updatedAt: new Date('2026-02-17T12:00:00Z'),
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockTokenService = createMockTokenService();
    mockNotificationService = createMockNotificationService();
    mockConfigService = createMockConfigService();
    mockBookingService = {
      updateKanbanStatus: jest.fn().mockResolvedValue({}),
    };

    const module = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: mockTokenService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: BookingService, useValue: mockBookingService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(QuoteService);
  });

  describe('create', () => {
    it('creates a quote and returns it with approval link', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue({ ...mockQuote, tokenId: 'mock-token-hex' } as any);

      const result = await service.create('biz1', {
        bookingId: 'b1',
        description: 'Replace front brake pads and rotors',
        totalAmount: 450,
      });

      expect(result.id).toBe('q1');
      expect(result.approvalLink).toContain('/manage/quote/mock-token-hex');
      expect(prisma.quote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'b1',
          businessId: 'biz1',
          description: 'Replace front brake pads and rotors',
          totalAmount: 450,
          status: 'PENDING',
        }),
      });
    });

    it('creates a token with QUOTE_APPROVAL type and 48h expiry', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue(mockQuote as any);

      await service.create('biz1', {
        bookingId: 'b1',
        description: 'Test',
        totalAmount: 100,
      });

      expect(mockTokenService.createToken).toHaveBeenCalledWith(
        'QUOTE_APPROVAL',
        'john@test.com',
        'biz1',
        undefined,
        48,
        'b1',
      );
    });

    it('moves kanban status to AWAITING_APPROVAL', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue(mockQuote as any);

      await service.create('biz1', {
        bookingId: 'b1',
        description: 'Test',
        totalAmount: 100,
      });

      expect(mockBookingService.updateKanbanStatus).toHaveBeenCalledWith(
        'biz1',
        'b1',
        'AWAITING_APPROVAL',
      );
    });

    it('sends quote approval notification', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue(mockQuote as any);

      await service.create('biz1', {
        bookingId: 'b1',
        description: 'Replace brakes',
        totalAmount: 450,
      });

      expect(mockNotificationService.sendQuoteApprovalRequest).toHaveBeenCalledWith(
        mockBooking,
        450,
        'Replace front brake pads and rotors', // Uses quote.description from created record
        expect.stringContaining('/manage/quote/'),
      );
    });

    it('throws NotFoundException when booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.create('biz1', { bookingId: 'nonexistent', description: 'Test', totalAmount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses phone when email is not available for token', async () => {
      const bookingNoEmail = { ...mockBooking, customer: { ...mockBooking.customer, email: null } };
      prisma.booking.findFirst.mockResolvedValue(bookingNoEmail as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue(mockQuote as any);

      await service.create('biz1', { bookingId: 'b1', description: 'Test', totalAmount: 100 });

      expect(mockTokenService.createToken).toHaveBeenCalledWith(
        'QUOTE_APPROVAL',
        '+1234567890',
        'biz1',
        undefined,
        48,
        'b1',
      );
    });

    it('stores pdfUrl when provided', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue(mockQuote as any);

      await service.create('biz1', {
        bookingId: 'b1',
        description: 'Test',
        totalAmount: 100,
        pdfUrl: 'https://example.com/quote.pdf',
      });

      expect(prisma.quote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pdfUrl: 'https://example.com/quote.pdf',
        }),
      });
    });
  });

  describe('findById', () => {
    it('returns a quote with booking relations', async () => {
      prisma.quote.findFirst.mockResolvedValue({
        ...mockQuote,
        booking: mockBooking,
      } as any);

      const result = await service.findById('biz1', 'q1');
      expect(result.id).toBe('q1');
      expect(prisma.quote.findFirst).toHaveBeenCalledWith({
        where: { id: 'q1', businessId: 'biz1' },
        include: expect.objectContaining({
          booking: expect.any(Object),
        }),
      });
    });

    it('throws NotFoundException when quote not found', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(service.findById('biz1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByBooking', () => {
    it('returns quotes for a booking ordered by createdAt desc', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);

      const result = await service.findByBooking('biz1', 'b1');
      expect(result).toHaveLength(1);
      expect(prisma.quote.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', businessId: 'biz1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getQuoteForApproval', () => {
    it('returns quote and booking summary for valid token', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'QUOTE_APPROVAL',
        bookingId: 'b1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      });
      prisma.quote.findFirst.mockResolvedValue(mockQuote as any);
      prisma.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        business: { id: 'biz1', name: 'Metro Auto Group' },
      } as any);

      const result = await service.getQuoteForApproval('abc123');

      expect(result.quote.id).toBe('q1');
      expect(result.quote.totalAmount).toBe(450);
      expect(result.booking.customer.name).toBe('John Smith');
      expect(result.business?.name).toBe('Metro Auto Group');
    });

    it('throws BadRequestException when token has no bookingId', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        bookingId: null,
      });

      await expect(service.getQuoteForApproval('abc123')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no pending quote found', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        bookingId: 'b1',
      });
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(service.getQuoteForApproval('abc123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveQuote', () => {
    beforeEach(() => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'QUOTE_APPROVAL',
        bookingId: 'b1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      });
      prisma.quote.findFirst.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'APPROVED',
        approvedAt: new Date(),
      } as any);
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
    });

    it('approves the quote and returns updated record', async () => {
      const result = await service.approveQuote('abc123', '192.168.1.1');

      expect(result.status).toBe('APPROVED');
      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: {
          status: 'APPROVED',
          approvedAt: expect.any(Date),
          approverIp: '192.168.1.1',
        },
      });
    });

    it('marks token as used before approving', async () => {
      await service.approveQuote('abc123');

      expect(mockTokenService.markUsed).toHaveBeenCalledWith('token1');
      // markUsed should be called before quote.update
      const markUsedOrder = mockTokenService.markUsed.mock.invocationCallOrder[0];
      const updateOrder = (prisma.quote.update as jest.Mock).mock.invocationCallOrder[0];
      expect(markUsedOrder).toBeLessThan(updateOrder);
    });

    it('moves kanban status to IN_PROGRESS', async () => {
      await service.approveQuote('abc123');

      expect(mockBookingService.updateKanbanStatus).toHaveBeenCalledWith(
        'biz1',
        'b1',
        'IN_PROGRESS',
      );
    });

    it('stores approver IP', async () => {
      await service.approveQuote('abc123', '10.0.0.1');

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: expect.objectContaining({
          approverIp: '10.0.0.1',
        }),
      });
    });

    it('handles null approver IP', async () => {
      await service.approveQuote('abc123');

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: expect.objectContaining({
          approverIp: null,
        }),
      });
    });

    it('throws BadRequestException when token has no bookingId', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        bookingId: null,
      });

      await expect(service.approveQuote('abc123')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no pending quote found', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(service.approveQuote('abc123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('side-effect resilience', () => {
    it('create succeeds when quote approval notification fails', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.quote.create.mockResolvedValue(mockQuote as any);
      prisma.quote.update.mockResolvedValue(mockQuote as any);
      mockNotificationService.sendQuoteApprovalRequest.mockRejectedValue(new Error('SMTP down'));

      const result = await service.create('biz1', {
        bookingId: 'b1',
        description: 'Test quote',
        totalAmount: 100,
      });

      expect(result.id).toBe('q1');
      expect(mockNotificationService.sendQuoteApprovalRequest).toHaveBeenCalled();
    });
  });
});
