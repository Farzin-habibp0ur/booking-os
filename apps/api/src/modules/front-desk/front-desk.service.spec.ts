import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma.service';
import { FrontDeskService } from './front-desk.service';

describe('FrontDeskService', () => {
  let service: FrontDeskService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      conversation: { count: jest.fn() },
      outboundDraft: { count: jest.fn(), findMany: jest.fn() },
      actionCard: { count: jest.fn() },
      message: { findMany: jest.fn() },
      booking: { findMany: jest.fn() },
      frontDeskAttribution: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [FrontDeskService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(FrontDeskService);
  });

  it('returns an empty conservative summary when no data exists', async () => {
    prisma.conversation.count.mockResolvedValue(0);
    prisma.outboundDraft.count.mockResolvedValue(0);
    prisma.frontDeskAttribution.findMany.mockResolvedValue([]);
    prisma.actionCard.count.mockResolvedValue(0);
    prisma.message.findMany.mockResolvedValue([]);
    prisma.outboundDraft.findMany.mockResolvedValue([]);

    const result = await service.getSummary('biz1', 30);

    expect(result).toEqual(
      expect.objectContaining({
        days: 30,
        leadsCaptured: 0,
        aiDrafts: 0,
        approvedReplies: 0,
        avgResponseMinutes: null,
        bookingsAttributed: 0,
        estimatedRecoveredRevenue: 0,
      }),
    );
  });

  it('combines explicit attribution and inferred AI-draft bookings', async () => {
    const inbound = new Date('2026-05-01T10:00:00Z');
    const outbound = new Date('2026-05-01T10:12:00Z');
    const sentAt = new Date('2026-05-02T10:00:00Z');

    prisma.conversation.count.mockResolvedValue(3);
    prisma.outboundDraft.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    prisma.frontDeskAttribution.findMany.mockResolvedValue([
      { bookingId: 'book-explicit', source: 'WAITLIST_CANCELLATION_FILL', estimatedValue: 300 },
    ]);
    prisma.actionCard.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prisma.message.findMany.mockResolvedValue([
      { conversationId: 'conv1', direction: 'INBOUND', createdAt: inbound },
      { conversationId: 'conv1', direction: 'OUTBOUND', createdAt: outbound },
    ]);
    prisma.outboundDraft.findMany.mockResolvedValue([
      { customerId: 'cust1', sentAt, createdAt: sentAt },
    ]);
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'book-inferred',
        customerId: 'cust1',
        createdAt: new Date('2026-05-04T10:00:00Z'),
        service: { price: 450 },
      },
    ]);

    const result = await service.getSummary('biz1', 30);

    expect(result.leadsCaptured).toBe(3);
    expect(result.aiDrafts).toBe(5);
    expect(result.approvedReplies).toBe(4);
    expect(result.avgResponseMinutes).toBe(12);
    expect(result.cancellationSlotsFilled).toBe(2);
    expect(result.consultFollowUps).toBe(2);
    expect(result.bookingsAttributed).toBe(2);
    expect(result.estimatedRecoveredRevenue).toBe(750);
  });

  it('caps the summary window to 365 days', async () => {
    prisma.conversation.count.mockResolvedValue(0);
    prisma.outboundDraft.count.mockResolvedValue(0);
    prisma.frontDeskAttribution.findMany.mockResolvedValue([]);
    prisma.actionCard.count.mockResolvedValue(0);
    prisma.message.findMany.mockResolvedValue([]);
    prisma.outboundDraft.findMany.mockResolvedValue([]);

    const result = await service.getSummary('biz1', 999);

    expect(result.days).toBe(365);
  });
});
