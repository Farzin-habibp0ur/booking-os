import { Test } from '@nestjs/testing';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('TrackingService', () => {
  let service: TrackingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [TrackingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(TrackingService);
  });

  describe('generateTrackingUrl', () => {
    it('produces a valid base64url-encoded tracking URL', () => {
      const url = service.generateTrackingUrl(
        'send1',
        'https://example.com',
        'https://api.test.com',
      );

      expect(url).toMatch(/^https:\/\/api\.test\.com\/api\/v1\/t\/.+/);
      // Decode and verify payload
      const trackingId = url.split('/t/')[1];
      const decoded = JSON.parse(Buffer.from(trackingId, 'base64url').toString('utf-8'));
      expect(decoded).toEqual({ s: 'send1', u: 'https://example.com' });
    });
  });

  describe('recordClick', () => {
    it('decodes tracking ID and creates CampaignClick record', async () => {
      prisma.campaignClick.create.mockResolvedValue({} as any);

      const trackingId = Buffer.from(
        JSON.stringify({ s: 'send1', u: 'https://example.com' }),
      ).toString('base64url');

      const result = await service.recordClick(trackingId, 'Mozilla/5.0');

      expect(result.url).toBe('https://example.com');
      expect(prisma.campaignClick.create).toHaveBeenCalledWith({
        data: {
          campaignSendId: 'send1',
          url: 'https://example.com',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('handles missing user agent', async () => {
      prisma.campaignClick.create.mockResolvedValue({} as any);

      const trackingId = Buffer.from(
        JSON.stringify({ s: 'send1', u: 'https://example.com' }),
      ).toString('base64url');

      await service.recordClick(trackingId);

      expect(prisma.campaignClick.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userAgent: null }),
      });
    });
  });

  describe('recordOpen', () => {
    it('sets openedAt on CampaignSend', async () => {
      prisma.campaignSend.updateMany.mockResolvedValue({ count: 1 } as any);

      const pixelId = Buffer.from('send1').toString('base64url');

      await service.recordOpen(pixelId);

      expect(prisma.campaignSend.updateMany).toHaveBeenCalledWith({
        where: { id: 'send1', openedAt: null },
        data: { openedAt: expect.any(Date) },
      });
    });
  });

  describe('generateTrackingPixel', () => {
    it('returns an img tag with correct URL', () => {
      const html = service.generateTrackingPixel('send1', 'https://api.test.com');

      expect(html).toContain('<img src="https://api.test.com/api/v1/t/o/');
      expect(html).toContain('width="1" height="1"');
      expect(html).toContain('style="display:none"');
    });
  });

  describe('wrapUrlsInContent', () => {
    it('replaces URLs in content with tracking URLs', () => {
      const content = 'Visit https://example.com for details or https://shop.com/sale';

      const result = service.wrapUrlsInContent(content, 'send1', 'https://api.test.com');

      expect(result).not.toContain('https://example.com');
      expect(result).not.toContain('https://shop.com/sale');
      expect(result).toContain('https://api.test.com/api/v1/t/');
      // Should have 2 tracking URLs
      const matches = result.match(/api\/v1\/t\//g);
      expect(matches).toHaveLength(2);
    });

    it('leaves content without URLs unchanged', () => {
      const content = 'Hello there, no URLs here!';

      const result = service.wrapUrlsInContent(content, 'send1', 'https://api.test.com');

      expect(result).toBe(content);
    });
  });
});
