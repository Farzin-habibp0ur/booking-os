import { Test } from '@nestjs/testing';
import { MessageService } from './message.service';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { createMockPrisma } from '../../test/mocks';

describe('MessageService', () => {
  let service: MessageService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockGateway: { notifyNewMessage: jest.Mock; notifyConversationUpdate: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockGateway = {
      notifyNewMessage: jest.fn(),
      notifyConversationUpdate: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: prisma },
        { provide: InboxGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(MessageService);
  });

  describe('sendMessage', () => {
    const mockProvider = {
      sendMessage: jest.fn().mockResolvedValue({ externalId: 'ext-123' }),
    };

    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      assignedToId: null,
      customer: { id: 'cust1', phone: '+1234567890', name: 'Emma' },
    };

    beforeEach(() => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.message.create.mockResolvedValue({
        id: 'msg1',
        direction: 'OUTBOUND',
        content: 'Hello!',
        senderStaff: { id: 'staff1', name: 'Dr. Chen' },
      } as any);
      prisma.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'WAITING',
        assignedToId: 'staff1',
      } as any);
    });

    it('sends message via provider and stores it', async () => {
      const result = await service.sendMessage('biz1', 'conv1', 'staff1', 'Hello!', mockProvider);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: 'Hello!',
        businessId: 'biz1',
        conversationId: 'conv1',
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv1',
          direction: 'OUTBOUND',
          senderStaffId: 'staff1',
          content: 'Hello!',
          externalId: 'ext-123',
        }),
        include: { senderStaff: { select: { id: true, name: true } } },
      });
      expect(result.id).toBe('msg1');
    });

    it('transitions conversation to WAITING status', async () => {
      await service.sendMessage('biz1', 'conv1', 'staff1', 'Hello!', mockProvider);

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'WAITING' }),
        }),
      );
    });

    it('auto-assigns staff when conversation is unassigned', async () => {
      await service.sendMessage('biz1', 'conv1', 'staff1', 'Hello!', mockProvider);

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedToId: 'staff1' }),
        }),
      );
    });

    it('does not reassign when already assigned', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        assignedToId: 'staff2',
      } as any);

      await service.sendMessage('biz1', 'conv1', 'staff1', 'Hello!', mockProvider);

      const updateCall = prisma.conversation.update.mock.calls[0][0];
      expect(updateCall.data.assignedToId).toBeUndefined();
    });

    it('notifies via WebSocket', async () => {
      await service.sendMessage('biz1', 'conv1', 'staff1', 'Hello!', mockProvider);

      expect(mockGateway.notifyNewMessage).toHaveBeenCalledWith('biz1', expect.any(Object));
      expect(mockGateway.notifyConversationUpdate).toHaveBeenCalledWith('biz1', expect.any(Object));
    });

    it('throws when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage('biz1', 'conv1', 'staff1', 'Hello!', mockProvider),
      ).rejects.toThrow('Conversation not found');
    });
  });

  describe('receiveInbound', () => {
    beforeEach(() => {
      prisma.message.create.mockResolvedValue({
        id: 'msg2',
        direction: 'INBOUND',
        content: 'Hi there',
      } as any);
      prisma.conversation.update.mockResolvedValue({
        id: 'conv1',
        status: 'OPEN',
        customer: { name: 'Emma' },
      } as any);
    });

    it('stores inbound message', async () => {
      await service.receiveInbound('biz1', 'conv1', 'Hi there', 'ext-456');

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv1',
          direction: 'INBOUND',
          content: 'Hi there',
          contentType: 'TEXT',
          externalId: 'ext-456',
        },
      });
    });

    it('reopens conversation to OPEN status', async () => {
      await service.receiveInbound('biz1', 'conv1', 'Hi there');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: expect.objectContaining({ status: 'OPEN' }),
        include: expect.any(Object),
      });
    });

    it('notifies via WebSocket', async () => {
      await service.receiveInbound('biz1', 'conv1', 'Hi there');

      expect(mockGateway.notifyNewMessage).toHaveBeenCalledWith('biz1', expect.any(Object));
      expect(mockGateway.notifyConversationUpdate).toHaveBeenCalledWith('biz1', expect.any(Object));
    });

    it('handles missing externalId', async () => {
      await service.receiveInbound('biz1', 'conv1', 'Hi there');

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ externalId: undefined }),
      });
    });
  });
});
