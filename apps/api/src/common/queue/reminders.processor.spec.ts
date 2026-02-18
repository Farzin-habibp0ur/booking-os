import { RemindersProcessor, ReminderJobData } from './reminders.processor';
import { Job } from 'bullmq';

describe('RemindersProcessor', () => {
  let processor: RemindersProcessor;

  beforeEach(() => {
    processor = new RemindersProcessor();
  });

  const createJob = (data: ReminderJobData): Job<ReminderJobData> => ({ id: 'job-1', data }) as any;

  it('throws when ReminderService is not available', async () => {
    (processor as any).moduleRef = { get: jest.fn().mockReturnValue(undefined) };

    const job = createJob({ reminderId: 'rem1' });

    await expect(processor.process(job)).rejects.toThrow('ReminderService not available');
  });

  it('calls processPendingReminders when service is available', async () => {
    const mockProcess = jest.fn().mockResolvedValue(undefined);
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ processPendingReminders: mockProcess }),
    };

    const job = createJob({ reminderId: 'rem1' });

    await processor.process(job);

    expect(mockProcess).toHaveBeenCalled();
  });

  it('re-throws when processPendingReminders fails', async () => {
    const mockProcess = jest.fn().mockRejectedValue(new Error('DB error'));
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ processPendingReminders: mockProcess }),
    };

    const job = createJob({ reminderId: 'rem1' });

    await expect(processor.process(job)).rejects.toThrow('DB error');
  });
});
