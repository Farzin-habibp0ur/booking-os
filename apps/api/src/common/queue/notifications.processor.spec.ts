import { NotificationsProcessor, NotificationJobData } from './notifications.processor';
import { Job } from 'bullmq';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;

  beforeEach(() => {
    processor = new NotificationsProcessor();
  });

  const createJob = (data: NotificationJobData): Job<NotificationJobData> =>
    ({ id: 'job-1', data }) as any;

  it('throws when EmailService is not available', async () => {
    (processor as any).moduleRef = { get: jest.fn().mockReturnValue(undefined) };

    const job = createJob({ to: 'test@test.com', subject: 'Test', html: '<p>hi</p>' });

    await expect(processor.process(job)).rejects.toThrow('EmailService not available');
  });

  it('calls email send when service is available', async () => {
    const mockSend = jest.fn().mockResolvedValue(undefined);
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ send: mockSend }),
    };

    const job = createJob({ to: 'test@test.com', subject: 'Test', html: '<p>hi</p>' });

    await processor.process(job);

    expect(mockSend).toHaveBeenCalledWith({
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>hi</p>',
    });
  });

  it('re-throws when email send fails', async () => {
    const mockSend = jest.fn().mockRejectedValue(new Error('SMTP error'));
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ send: mockSend }),
    };

    const job = createJob({ to: 'test@test.com', subject: 'Test', html: '<p>hi</p>' });

    await expect(processor.process(job)).rejects.toThrow('SMTP error');
  });
});
