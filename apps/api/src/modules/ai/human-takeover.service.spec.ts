import { Test } from '@nestjs/testing';
import { HumanTakeoverService } from './human-takeover.service';
import { ActionCardService } from '../action-card/action-card.service';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { createMockPrisma } from '../../test/mocks';

describe('HumanTakeoverService', () => {
  let service: HumanTakeoverService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionCardService: { create: jest.Mock; dismiss: jest.Mock };
  let inboxGateway: { emitToBusinessRoom: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionCardService = {
      create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }),
      dismiss: jest.fn().mockResolvedValue({ id: 'card1', status: 'DISMISSED' }),
    };
    inboxGateway = { emitToBusinessRoom: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        HumanTakeoverService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionCardService, useValue: actionCardService },
        { provide: InboxGateway, useValue: inboxGateway },
      ],
    }).compile();

    service = module.get(HumanTakeoverService);
  });

  describe('inititateTakeover', () => {
    it('marks conversation as transferred and creates card', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        metadata: {},
      } as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      const result = await service.inititateTakeover(
        'biz1',
        'conv1',
        'customer requested human',
        'cust1',
        'Emma',
      );

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              transferredToHuman: true,
              transferReason: 'customer requested human',
            }),
          }),
        }),
      );
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HUMAN_TAKEOVER',
          category: 'URGENT_TODAY',
          priority: 95,
        }),
      );
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'conversation:takeover',
        expect.objectContaining({ conversationId: 'conv1' }),
      );
    });

    it('returns null when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.inititateTakeover('biz1', 'conv1', 'reason');

      expect(result).toBeNull();
    });

    it('handles error gracefully', async () => {
      prisma.conversation.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await service.inititateTakeover('biz1', 'conv1', 'reason');

      expect(result).toBeNull();
    });
  });

  describe('resolveTakeover', () => {
    it('clears transfer flag and dismisses pending cards', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        metadata: { transferredToHuman: true },
      } as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      prisma.actionCard.findMany.mockResolvedValue([
        { id: 'card1', status: 'PENDING' },
      ] as any);

      const result = await service.resolveTakeover('biz1', 'conv1', 'staff1');

      expect(result).toEqual({ resolved: true, conversationId: 'conv1' });
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              transferredToHuman: false,
            }),
            assignedToId: 'staff1',
          }),
        }),
      );
      expect(actionCardService.dismiss).toHaveBeenCalledWith('biz1', 'card1', 'staff1');
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'conversation:takeover-resolved',
        expect.objectContaining({ conversationId: 'conv1', staffId: 'staff1' }),
      );
    });

    it('returns null when not transferred', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        metadata: {},
      } as any);

      const result = await service.resolveTakeover('biz1', 'conv1', 'staff1');

      expect(result).toBeNull();
    });

    it('returns null when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.resolveTakeover('biz1', 'conv1', 'staff1');

      expect(result).toBeNull();
    });
  });

  describe('isConversationTakenOver', () => {
    it('returns true when transferred', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        metadata: { transferredToHuman: true },
      } as any);

      const result = await service.isConversationTakenOver('biz1', 'conv1');

      expect(result).toBe(true);
    });

    it('returns false when not transferred', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        metadata: {},
      } as any);

      const result = await service.isConversationTakenOver('biz1', 'conv1');

      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      prisma.conversation.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await service.isConversationTakenOver('biz1', 'conv1');

      expect(result).toBe(false);
    });
  });
});
