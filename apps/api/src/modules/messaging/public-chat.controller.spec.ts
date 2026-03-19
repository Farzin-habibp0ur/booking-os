import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PublicChatController } from './public-chat.controller';
import { PrismaService } from '../../common/prisma.service';

describe('PublicChatController', () => {
  let controller: PublicChatController;
  let mockPrisma: { business: { findFirst: jest.Mock } };

  beforeEach(async () => {
    mockPrisma = {
      business: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicChatController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    controller = module.get<PublicChatController>(PublicChatController);
  });

  describe('GET /public/chat/config/:businessSlug', () => {
    it('should return default chat config when business has no channelSettings', async () => {
      mockPrisma.business.findFirst.mockResolvedValue({
        id: 'biz1',
        name: 'Glow Clinic',
        channelSettings: null,
      });

      const result = await controller.getChatConfig('glow-clinic');

      expect(result).toEqual({
        businessName: 'Glow Clinic',
        greeting: 'Welcome to Glow Clinic! How can we help you?',
        theme: { primaryColor: '#71907C' },
        preChatFields: ['name', 'email'],
        offlineMessage: "We're currently offline. Leave a message and we'll get back to you.",
        online: true,
      });

      expect(mockPrisma.business.findFirst).toHaveBeenCalledWith({
        where: { slug: 'glow-clinic' },
        select: { id: true, name: true, channelSettings: true },
      });
    });

    it('should return custom chat config from channelSettings.webChat', async () => {
      mockPrisma.business.findFirst.mockResolvedValue({
        id: 'biz2',
        name: 'Metro Auto',
        channelSettings: {
          webChat: {
            greeting: 'Hey there! Need a car?',
            theme: { primaryColor: '#FF5733' },
            preChatFields: ['name', 'email', 'phone'],
            offlineMessage: 'We are closed. Email us!',
          },
        },
      });

      const result = await controller.getChatConfig('metro-auto');

      expect(result).toEqual({
        businessName: 'Metro Auto',
        greeting: 'Hey there! Need a car?',
        theme: { primaryColor: '#FF5733' },
        preChatFields: ['name', 'email', 'phone'],
        offlineMessage: 'We are closed. Email us!',
        online: true,
      });
    });

    it('should throw NotFoundException when business slug not found', async () => {
      mockPrisma.business.findFirst.mockResolvedValue(null);

      await expect(controller.getChatConfig('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should handle channelSettings without webChat key', async () => {
      mockPrisma.business.findFirst.mockResolvedValue({
        id: 'biz3',
        name: 'Serenity Spa',
        channelSettings: { sms: { enabled: true } },
      });

      const result = await controller.getChatConfig('serenity-spa');

      expect(result.businessName).toBe('Serenity Spa');
      expect(result.greeting).toBe('Welcome to Serenity Spa! How can we help you?');
      expect(result.theme).toEqual({ primaryColor: '#71907C' });
      expect(result.preChatFields).toEqual(['name', 'email']);
    });

    it('should handle partial webChat config — fills in defaults for missing fields', async () => {
      mockPrisma.business.findFirst.mockResolvedValue({
        id: 'biz4',
        name: 'Partial Biz',
        channelSettings: {
          webChat: {
            greeting: 'Custom greeting only',
          },
        },
      });

      const result = await controller.getChatConfig('partial-biz');

      expect(result.greeting).toBe('Custom greeting only');
      expect(result.theme).toEqual({ primaryColor: '#71907C' }); // default
      expect(result.preChatFields).toEqual(['name', 'email']); // default
    });
  });
});
