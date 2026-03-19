import { Test, TestingModule } from '@nestjs/testing';
import { ChannelStatusController } from './channel-status.controller';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('ChannelStatusController', () => {
  let controller: ChannelStatusController;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelStatusController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(ChannelStatusController);
  });

  describe('getChannelStatus', () => {
    it('should return all channels as false when no locations configured', async () => {
      (prisma.location.findMany as jest.Mock).mockResolvedValue([]);

      const result = await controller.getChannelStatus('biz1');

      expect(result.channels).toEqual({
        WHATSAPP: false,
        INSTAGRAM: false,
        FACEBOOK: false,
        SMS: false,
        EMAIL: false,
        WEB_CHAT: false,
      });
      expect(result.locationCount).toBe(0);
    });

    it('should detect configured channels from locations', async () => {
      (prisma.location.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'loc1',
          name: 'Main',
          whatsappConfig: { phoneNumberId: 'phone123' },
          instagramConfig: null,
          facebookConfig: { pageId: 'fb_page_1' },
          smsConfig: { phoneNumber: '+1234567890' },
          emailConfig: null,
          webChatConfig: { enabled: true },
        },
      ]);

      const result = await controller.getChannelStatus('biz1');

      expect(result.channels).toEqual({
        WHATSAPP: true,
        INSTAGRAM: false,
        FACEBOOK: true,
        SMS: true,
        EMAIL: false,
        WEB_CHAT: true,
      });
      expect(result.locationCount).toBe(1);
    });

    it('should query only active locations for the business', async () => {
      (prisma.location.findMany as jest.Mock).mockResolvedValue([]);

      await controller.getChannelStatus('biz1');

      expect(prisma.location.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', isActive: true },
        select: {
          id: true,
          name: true,
          whatsappConfig: true,
          instagramConfig: true,
          facebookConfig: true,
          smsConfig: true,
          emailConfig: true,
          webChatConfig: true,
        },
      });
    });

    it('should detect email and instagram channels', async () => {
      (prisma.location.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'loc1',
          name: 'Branch',
          whatsappConfig: null,
          instagramConfig: { pageId: 'ig_page_1' },
          facebookConfig: null,
          smsConfig: null,
          emailConfig: { inboundAddress: 'inbox@example.com' },
          webChatConfig: null,
        },
      ]);

      const result = await controller.getChannelStatus('biz1');

      expect(result.channels.INSTAGRAM).toBe(true);
      expect(result.channels.EMAIL).toBe(true);
      expect(result.channels.WHATSAPP).toBe(false);
    });
  });
});
