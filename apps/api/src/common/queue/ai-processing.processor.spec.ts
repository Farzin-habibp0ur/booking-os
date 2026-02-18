import { AiProcessingProcessor, AiProcessingJobData } from './ai-processing.processor';
import { Job } from 'bullmq';

describe('AiProcessingProcessor', () => {
  let processor: AiProcessingProcessor;

  beforeEach(() => {
    processor = new AiProcessingProcessor();
  });

  const createJob = (data: AiProcessingJobData): Job<AiProcessingJobData> =>
    ({ id: 'job-1', data }) as any;

  it('throws when AiService is not available', async () => {
    (processor as any).moduleRef = { get: jest.fn().mockReturnValue(undefined) };

    const job = createJob({
      businessId: 'biz1',
      conversationId: 'conv1',
      messageId: 'msg1',
      messageBody: 'hello',
    });

    await expect(processor.process(job)).rejects.toThrow('AiService not available');
  });

  it('calls processInboundMessage when AiService is available', async () => {
    const mockProcess = jest.fn().mockResolvedValue(undefined);
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ processInboundMessage: mockProcess }),
    };

    const job = createJob({
      businessId: 'biz1',
      conversationId: 'conv1',
      messageId: 'msg1',
      messageBody: 'hello',
    });

    await processor.process(job);

    expect(mockProcess).toHaveBeenCalledWith('biz1', 'conv1', 'msg1', 'hello');
  });

  it('re-throws when processInboundMessage fails', async () => {
    const mockProcess = jest.fn().mockRejectedValue(new Error('AI failed'));
    (processor as any).moduleRef = {
      get: jest.fn().mockReturnValue({ processInboundMessage: mockProcess }),
    };

    const job = createJob({
      businessId: 'biz1',
      conversationId: 'conv1',
      messageId: 'msg1',
      messageBody: 'hello',
    });

    await expect(processor.process(job)).rejects.toThrow('AI failed');
  });
});
