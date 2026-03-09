import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { MessageService } from './message.service';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { createMockPrisma } from '../../test/mocks';

describe('MessageService', () => {
  let service: MessageService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockGateway: {
    notifyNewMessage: jest.Mock;
    notifyConversationUpdate: jest.Mock;
    emitToBusinessRoom: jest.Mock;
  };
  let mockQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockGateway = {
      notifyNewMessage: jest.fn(),
      notifyConversationUpdate: jest.fn(),
      emitToBusinessRoom: jest.fn(),
    };
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJob: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: prisma },
        { provide: InboxGateway, useValue: mockGateway },
        { provide: getQueueToken('messaging'), useValue: mockQueue },
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
        include: {
          senderStaff: { select: { id: true, name: true } },
          attachments: true,
        },
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

  describe('sendMessage (scheduled)', () => {
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
        id: 'msg-sched',
        direction: 'OUTBOUND',
        content: 'Scheduled!',
        deliveryStatus: 'SCHEDULED',
        senderStaff: { id: 'staff1', name: 'Dr. Chen' },
      } as any);
      prisma.message.update.mockResolvedValue({} as any);
    });

    it('creates scheduled message with BullMQ delayed job', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const result = await service.sendMessage(
        'biz1',
        'conv1',
        'staff1',
        'Scheduled!',
        mockProvider,
        futureDate,
      );

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deliveryStatus: 'SCHEDULED',
          scheduledFor: futureDate,
        }),
        include: expect.any(Object),
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'scheduled-message',
        { messageId: 'msg-sched', businessId: 'biz1' },
        { delay: expect.any(Number) },
      );
      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(result.scheduledJobId).toBe('job-123');
    });

    it('sends immediately when no scheduledFor provided', async () => {
      prisma.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'WAITING',
      } as any);

      await service.sendMessage('biz1', 'conv1', 'staff1', 'Now!', mockProvider);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('sends immediately when scheduledFor is in the past', async () => {
      prisma.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'WAITING',
      } as any);
      const pastDate = new Date(Date.now() - 1000);

      await service.sendMessage('biz1', 'conv1', 'staff1', 'Past!', mockProvider, pastDate);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getScheduledMessages', () => {
    it('returns scheduled messages for conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' } as any);
      const msgs = [{ id: 'm1', deliveryStatus: 'SCHEDULED' }];
      prisma.message.findMany.mockResolvedValue(msgs as any);

      const result = await service.getScheduledMessages('biz1', 'conv1');

      expect(result).toEqual(msgs);
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv1',
          deliveryStatus: 'SCHEDULED',
          scheduledFor: { not: null },
        },
        include: { senderStaff: { select: { id: true, name: true } } },
        orderBy: { scheduledFor: 'asc' },
      });
    });

    it('returns empty array when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.getScheduledMessages('biz1', 'conv1');

      expect(result).toEqual([]);
    });
  });

  describe('cancelScheduledMessage', () => {
    it('cancels message and removes BullMQ job', async () => {
      const mockJob = { remove: jest.fn() };
      prisma.message.findFirst.mockResolvedValue({
        id: 'msg1',
        deliveryStatus: 'SCHEDULED',
        scheduledJobId: 'job-123',
      } as any);
      mockQueue.getJob.mockResolvedValue(mockJob);
      prisma.message.update.mockResolvedValue({ id: 'msg1', deliveryStatus: 'CANCELLED' } as any);

      const result = await service.cancelScheduledMessage('biz1', 'conv1', 'msg1');

      expect(mockJob.remove).toHaveBeenCalled();
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg1' },
        data: { deliveryStatus: 'CANCELLED' },
      });
      expect(result.deliveryStatus).toBe('CANCELLED');
    });

    it('throws NotFoundException when message not found', async () => {
      prisma.message.findFirst.mockResolvedValue(null);

      await expect(service.cancelScheduledMessage('biz1', 'conv1', 'msg1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('handles missing BullMQ job gracefully', async () => {
      prisma.message.findFirst.mockResolvedValue({
        id: 'msg1',
        deliveryStatus: 'SCHEDULED',
        scheduledJobId: 'job-gone',
      } as any);
      mockQueue.getJob.mockResolvedValue(null);
      prisma.message.update.mockResolvedValue({ id: 'msg1', deliveryStatus: 'CANCELLED' } as any);

      const result = await service.cancelScheduledMessage('biz1', 'conv1', 'msg1');

      expect(result.deliveryStatus).toBe('CANCELLED');
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

  describe('updateDeliveryStatus', () => {
    const mockMessage = {
      id: 'msg1',
      conversationId: 'conv1',
      deliveredAt: null,
      readAt: null,
      conversation: { businessId: 'biz1' },
    };

    it('updates status to DELIVERED with timestamp', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage as any);
      prisma.message.update.mockResolvedValue({
        ...mockMessage,
        deliveryStatus: 'DELIVERED',
      } as any);

      const result = await service.updateDeliveryStatus('ext1', 'DELIVERED');

      expect(result).toBeTruthy();
      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: 'DELIVERED',
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });

    it('updates status to READ and backfills deliveredAt', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage as any);
      prisma.message.update.mockResolvedValue({
        ...mockMessage,
        deliveryStatus: 'READ',
      } as any);

      await service.updateDeliveryStatus('ext1', 'READ');

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: 'READ',
            readAt: expect.any(Date),
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not overwrite existing deliveredAt on READ', async () => {
      const delivered = new Date('2026-01-01');
      prisma.message.findUnique.mockResolvedValue({
        ...mockMessage,
        deliveredAt: delivered,
      } as any);
      prisma.message.update.mockResolvedValue({} as any);

      await service.updateDeliveryStatus('ext1', 'READ');

      const updateCall = prisma.message.update.mock.calls[0][0];
      expect(updateCall.data.deliveredAt).toBeUndefined();
    });

    it('updates status to FAILED with reason', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage as any);
      prisma.message.update.mockResolvedValue({
        ...mockMessage,
        deliveryStatus: 'FAILED',
      } as any);

      await service.updateDeliveryStatus('ext1', 'FAILED', 'Number invalid');

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: 'FAILED',
            failureReason: 'Number invalid',
          }),
        }),
      );
    });

    it('defaults failureReason to Unknown error', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage as any);
      prisma.message.update.mockResolvedValue({} as any);

      await service.updateDeliveryStatus('ext1', 'FAILED');

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failureReason: 'Unknown error' }),
        }),
      );
    });

    it('returns null when message not found', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      const result = await service.updateDeliveryStatus('missing', 'DELIVERED');
      expect(result).toBeNull();
    });

    it('emits message:status WebSocket event', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage as any);
      prisma.message.update.mockResolvedValue({} as any);

      await service.updateDeliveryStatus('ext1', 'DELIVERED');

      expect(mockGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'message:status',
        expect.objectContaining({
          messageId: 'msg1',
          conversationId: 'conv1',
          deliveryStatus: 'DELIVERED',
        }),
      );
    });
  });
});
