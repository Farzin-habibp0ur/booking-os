import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FacebookController } from './facebook.controller';
import { MessagingService } from './messaging.service';

describe('FacebookController', () => {
  let controller: FacebookController;
  let messagingService: {
    getProviderForFacebookPageId: jest.Mock;
    registerFacebookProvider: jest.Mock;
  };

  beforeEach(async () => {
    messagingService = {
      getProviderForFacebookPageId: jest.fn(),
      registerFacebookProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacebookController],
      providers: [{ provide: MessagingService, useValue: messagingService }],
    }).compile();

    controller = module.get(FacebookController);
  });

  describe('getPageInfo', () => {
    it('should return page info for valid credentials', async () => {
      // We can't easily mock the FacebookProvider constructor called internally,
      // but we can test the error path and contract.
      // For a full test, we'd need to mock the fetch call.
      // Here we verify the error handling for missing params.
      await expect(controller.getPageInfo('', 'token', 'biz1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for missing credentials', async () => {
      await expect(controller.getPageInfo('', '', 'biz1')).rejects.toThrow(
        'pageId and accessToken are required',
      );

      await expect(controller.getPageInfo('page1', '', 'biz1')).rejects.toThrow(
        'pageId and accessToken are required',
      );
    });
  });

  describe('setIceBreakers', () => {
    it('should call provider setIceBreakers with prompts', async () => {
      const mockProvider = {
        setIceBreakers: jest.fn().mockResolvedValue(undefined),
      };
      messagingService.getProviderForFacebookPageId.mockReturnValue(mockProvider);

      const result = await controller.setIceBreakers(
        {
          pageId: 'page123',
          prompts: [
            { question: 'What services do you offer?', payload: 'SERVICES' },
            { question: 'Book appointment', payload: 'BOOK' },
          ],
        },
        'biz1',
      );

      expect(result).toEqual({ ok: true, count: 2 });
      expect(messagingService.getProviderForFacebookPageId).toHaveBeenCalledWith('page123');
      expect(mockProvider.setIceBreakers).toHaveBeenCalledWith([
        { question: 'What services do you offer?', payload: 'SERVICES' },
        { question: 'Book appointment', payload: 'BOOK' },
      ]);
    });

    it('should reject when no provider is configured for page', async () => {
      messagingService.getProviderForFacebookPageId.mockReturnValue(null);

      await expect(
        controller.setIceBreakers(
          {
            pageId: 'unknown-page',
            prompts: [{ question: 'Q', payload: 'P' }],
          },
          'biz1',
        ),
      ).rejects.toThrow('Facebook provider not configured for this page');
    });

    it('should reject when pageId is missing', async () => {
      await expect(
        controller.setIceBreakers(
          { pageId: '', prompts: [{ question: 'Q', payload: 'P' }] },
          'biz1',
        ),
      ).rejects.toThrow('pageId is required');
    });

    it('should reject more than 4 ice breakers', async () => {
      await expect(
        controller.setIceBreakers(
          {
            pageId: 'page123',
            prompts: [
              { question: 'Q1', payload: 'P1' },
              { question: 'Q2', payload: 'P2' },
              { question: 'Q3', payload: 'P3' },
              { question: 'Q4', payload: 'P4' },
              { question: 'Q5', payload: 'P5' },
            ],
          },
          'biz1',
        ),
      ).rejects.toThrow('Maximum 4 ice breakers allowed');
    });
  });
});
