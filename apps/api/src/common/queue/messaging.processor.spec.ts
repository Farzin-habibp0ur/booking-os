import { MessagingProcessor, MessagingJobData } from './messaging.processor';
import { Job } from 'bullmq';

describe('MessagingProcessor', () => {
  let processor: MessagingProcessor;

  beforeEach(() => {
    processor = new MessagingProcessor();
  });

  const createJob = (data: MessagingJobData): Job<MessagingJobData> =>
    ({ id: 'job-1', data }) as any;

  it('throws when MessagingService is not available', async () => {
    (processor as any).moduleRef = { get: jest.fn().mockReturnValue(undefined) };

    const job = createJob({ to: '+123456', body: 'hello', businessId: 'biz1' });

    await expect(processor.process(job)).rejects.toThrow('MessagingService not available');
  });

  it('sends message when service is available', async () => {
    const mockSendMessage = jest.fn().mockResolvedValue(undefined);
    const mockGetProvider = jest.fn().mockReturnValue({ sendMessage: mockSendMessage });
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ getProvider: mockGetProvider }),
    };

    const job = createJob({ to: '+123456', body: 'hello', businessId: 'biz1' });

    await processor.process(job);

    expect(mockSendMessage).toHaveBeenCalledWith({
      to: '+123456',
      body: 'hello',
      businessId: 'biz1',
    });
  });

  it('re-throws when sendMessage fails', async () => {
    const mockSendMessage = jest.fn().mockRejectedValue(new Error('WhatsApp API error'));
    const mockGetProvider = jest.fn().mockReturnValue({ sendMessage: mockSendMessage });
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ getProvider: mockGetProvider }),
    };

    const job = createJob({ to: '+123456', body: 'hello', businessId: 'biz1' });

    await expect(processor.process(job)).rejects.toThrow('WhatsApp API error');
  });
});
