import { BadRequestException } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

describe('BusinessController', () => {
  let controller: BusinessController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findById: jest.fn(),
      update: jest.fn(),
      getBranding: jest.fn(),
      updateBranding: jest.fn(),
      getNotificationSettings: jest.fn(),
      updateNotificationSettings: jest.fn(),
      getPolicySettings: jest.fn(),
      updatePolicySettings: jest.fn(),
      installPack: jest.fn(),
      getWaitlistSettings: jest.fn(),
      updateWaitlistSettings: jest.fn(),
      getOnboardingStatus: jest.fn(),
      createTestBooking: jest.fn(),
      getActivationStatus: jest.fn(),
      markActivationAction: jest.fn(),
      submitNps: jest.fn(),
    };
    controller = new BusinessController(mockService as unknown as BusinessService);
  });

  // ────────────────────────────────────────────────────────────
  // GET /business/branding
  // ────────────────────────────────────────────────────────────
  describe('GET /business/branding', () => {
    it('should return branding data', async () => {
      const branding = {
        logoUrl: 'brand-abc.png',
        brandPrimaryColor: '#FF5733',
        brandTagline: 'Your beauty, our passion',
        brandFaviconUrl: null,
      };
      mockService.getBranding.mockResolvedValue(branding);

      const result = await controller.getBranding('biz1');

      expect(mockService.getBranding).toHaveBeenCalledWith('biz1');
      expect(result).toEqual(branding);
    });
  });

  // ────────────────────────────────────────────────────────────
  // PATCH /business/branding
  // ────────────────────────────────────────────────────────────
  describe('PATCH /business/branding', () => {
    it('should call service with dto', async () => {
      const dto = { brandPrimaryColor: '#123456', brandTagline: 'New tagline' };
      mockService.updateBranding.mockResolvedValue({ id: 'biz1' });

      const result = await controller.updateBranding('biz1', dto as any);

      expect(mockService.updateBranding).toHaveBeenCalledWith('biz1', dto, undefined);
      expect(result).toEqual({ id: 'biz1' });
    });

    it('should reject invalid file type', async () => {
      const logo = {
        mimetype: 'application/pdf',
        size: 1024,
        originalname: 'file.pdf',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      await expect(controller.updateBranding('biz1', {} as any, logo)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.updateBranding('biz1', {} as any, logo)).rejects.toThrow(
        'Logo must be PNG, JPG, or SVG',
      );
      expect(mockService.updateBranding).not.toHaveBeenCalled();
    });

    it('should reject files over 2MB', async () => {
      const logo = {
        mimetype: 'image/png',
        size: 3 * 1024 * 1024,
        originalname: 'big.png',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      await expect(controller.updateBranding('biz1', {} as any, logo)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.updateBranding('biz1', {} as any, logo)).rejects.toThrow(
        'Logo must be under 2MB',
      );
      expect(mockService.updateBranding).not.toHaveBeenCalled();
    });

    it('should accept valid PNG file and call service with logoKey', async () => {
      const logo = {
        mimetype: 'image/png',
        size: 1024,
        originalname: 'logo.png',
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;
      mockService.updateBranding.mockResolvedValue({ id: 'biz1' });

      const result = await controller.updateBranding('biz1', {} as any, logo);

      expect(mockService.updateBranding).toHaveBeenCalledWith(
        'biz1',
        {},
        expect.stringMatching(/^brand-.*\.png$/),
      );
      expect(result).toEqual({ id: 'biz1' });
    });

    it('should accept valid SVG file', async () => {
      const logo = {
        mimetype: 'image/svg+xml',
        size: 512,
        originalname: 'logo.svg',
        buffer: Buffer.from('<svg></svg>'),
      } as Express.Multer.File;
      mockService.updateBranding.mockResolvedValue({ id: 'biz1' });

      await controller.updateBranding('biz1', {} as any, logo);

      expect(mockService.updateBranding).toHaveBeenCalledWith(
        'biz1',
        {},
        expect.stringMatching(/^brand-.*\.svg$/),
      );
    });
  });
});
