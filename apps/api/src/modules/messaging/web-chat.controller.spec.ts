import { Test, TestingModule } from '@nestjs/testing';
import { WebChatController } from './web-chat.controller';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('WebChatController', () => {
  let controller: WebChatController;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebChatController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(WebChatController);
  });

  describe('getConfig', () => {
    it('should return defaults when no settings exist', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        id: 'biz1',
        channelSettings: null,
      });

      const result = await controller.getConfig('biz1');

      expect(result.primaryColor).toBe('#71907C');
      expect(result.title).toBe('Chat with us');
      expect(result.subtitle).toBe('We typically reply within minutes');
      expect(result.placeholder).toBe('Type a message...');
      expect(result.position).toBe('bottom-right');
      expect(result.preChatFields).toEqual(['name', 'email']);
      expect(result.offlineMessage).toBe('We are currently offline. Leave us a message!');
      expect(result.showOfflineForm).toBe(true);
    });

    it('should return saved settings when they exist', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        id: 'biz1',
        channelSettings: {
          webChat: {
            primaryColor: '#FF0000',
            title: 'Help Center',
            subtitle: 'Ask away!',
            placeholder: 'Your question...',
            position: 'bottom-left',
            preChatFields: ['name', 'email', 'phone'],
            offlineMessage: 'Come back later!',
            showOfflineForm: false,
          },
        },
      });

      const result = await controller.getConfig('biz1');

      expect(result.primaryColor).toBe('#FF0000');
      expect(result.title).toBe('Help Center');
      expect(result.subtitle).toBe('Ask away!');
      expect(result.placeholder).toBe('Your question...');
      expect(result.position).toBe('bottom-left');
      expect(result.preChatFields).toEqual(['name', 'email', 'phone']);
      expect(result.offlineMessage).toBe('Come back later!');
      expect(result.showOfflineForm).toBe(false);
    });
  });

  describe('saveConfig', () => {
    it('should update channelSettings.webChat', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        id: 'biz1',
        channelSettings: {},
      });
      (prisma.business.update as jest.Mock).mockResolvedValue({ id: 'biz1' });

      const result = await controller.saveConfig('biz1', {
        primaryColor: '#00FF00',
        title: 'New Title',
      });

      expect(result).toEqual({ ok: true });
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          channelSettings: {
            webChat: {
              primaryColor: '#00FF00',
              title: 'New Title',
            },
          },
        },
      });
    });

    it('should preserve other channelSettings', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        id: 'biz1',
        channelSettings: {
          sms: { twilioAccountSid: 'AC123' },
          webChat: { primaryColor: '#71907C', title: 'Old Title' },
        },
      });
      (prisma.business.update as jest.Mock).mockResolvedValue({ id: 'biz1' });

      await controller.saveConfig('biz1', { title: 'Updated Title' });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          channelSettings: {
            sms: { twilioAccountSid: 'AC123' },
            webChat: {
              primaryColor: '#71907C',
              title: 'Updated Title',
            },
          },
        },
      });
    });
  });
});
