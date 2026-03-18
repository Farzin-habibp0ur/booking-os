import { Test } from '@nestjs/testing';
import { CockpitTasksContextService } from './cockpit-tasks-context.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('CockpitTasksContextService', () => {
  let service: CockpitTasksContextService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [CockpitTasksContextService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(CockpitTasksContextService);
  });

  describe('buildContext', () => {
    it('returns context with non-empty sections', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          status: 'CONFIRMED',
          startTime: new Date(),
          endTime: new Date(),
          customer: { id: 'c1', name: 'Emma Wilson', phone: '+1234' },
          service: { id: 's1', name: 'Botox', durationMins: 30 },
          staff: { id: 'st1', name: 'Sarah' },
        },
      ] as any);
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.waitlistEntry.findMany.mockResolvedValue([]);
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.staff.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      const context = await service.buildContext('biz1');

      expect(context.sections.length).toBeGreaterThan(0);
      expect(context.generatedAt).toBeDefined();

      const bookingSection = context.sections.find((s) => s.label === "Today's Bookings");
      expect(bookingSection).toBeDefined();
      expect(bookingSection!.content).toContain('Emma Wilson');
      expect(bookingSection!.content).toContain('Botox');
      expect(bookingSection!.content).toContain('Sarah');
    });

    it('includes pending action cards with metadata', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findMany.mockResolvedValue([
        {
          id: 'card1',
          category: 'URGENT_TODAY',
          priority: 90,
          title: 'Deposit pending for Emma',
          description: 'Botox in 2 days',
          type: 'DEPOSIT_PENDING',
          metadata: { sourceAgentId: 'waitlist-agent' },
          staff: { id: 'st1', name: 'Sarah' },
          customer: { id: 'c1', name: 'Emma' },
          booking: null,
        },
      ] as any);
      prisma.waitlistEntry.findMany.mockResolvedValue([]);
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.staff.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      const context = await service.buildContext('biz1');

      const cardSection = context.sections.find((s) => s.label === 'Pending Action Cards');
      expect(cardSection).toBeDefined();
      expect(cardSection!.content).toContain('Deposit pending for Emma');
      expect(cardSection!.content).toContain('Sarah');
      expect(cardSection!.content).toContain('card1');
    });

    it('includes overdue bookings with days count', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      // findMany is called multiple times; for overdue test, return overdue booking on first call (today's bookings returns empty),
      // then overdue booking on second call (overdue query)
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // today's bookings
        .mockResolvedValueOnce([
          {
            id: 'b-overdue',
            status: 'PENDING',
            startTime: threeDaysAgo,
            customer: { name: 'John' },
            service: { name: 'Consult' },
            staff: { name: 'Mike' },
          },
        ] as any);
      prisma.actionCard.findMany
        .mockResolvedValueOnce([]) // pending action cards
        .mockResolvedValueOnce([]); // expired cards
      prisma.waitlistEntry.findMany.mockResolvedValue([]);
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.staff.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      const context = await service.buildContext('biz1');

      const overdueSection = context.sections.find((s) => s.label === 'Overdue Items');
      expect(overdueSection).toBeDefined();
      expect(overdueSection!.content).toContain('OVERDUE BOOKING');
      expect(overdueSection!.content).toContain('John');
      expect(overdueSection!.content).toContain('Consult');
    });

    it('excludes empty sections', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.waitlistEntry.findMany.mockResolvedValue([]);
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.staff.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      const context = await service.buildContext('biz1');

      expect(context.sections).toHaveLength(0);
    });

    it('includes conversation backlog with timing', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.waitlistEntry.findMany.mockResolvedValue([]);
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.staff.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          status: 'OPEN',
          lastMessageAt: twoHoursAgo,
          customer: { name: 'Alice' },
          assignedTo: { name: 'Bob' },
        },
      ] as any);
      prisma.booking.count.mockResolvedValue(0);

      const context = await service.buildContext('biz1');

      const convSection = context.sections.find((s) => s.label === 'Conversation Backlog');
      expect(convSection).toBeDefined();
      expect(convSection!.content).toContain('Alice');
      expect(convSection!.content).toContain('Bob');
      expect(convSection!.content).toContain('conv1');
    });
  });

  describe('formatContextForPrompt', () => {
    it('formats sections with headers', () => {
      const context = {
        sections: [
          { label: 'Bookings', content: '3 bookings today' },
          { label: 'Action Cards', content: '2 pending cards' },
        ],
        generatedAt: new Date().toISOString(),
      };

      const result = service.formatContextForPrompt(context);

      expect(result).toContain('## Section 1: Bookings');
      expect(result).toContain('3 bookings today');
      expect(result).toContain('## Section 2: Action Cards');
      expect(result).toContain('2 pending cards');
    });
  });
});
