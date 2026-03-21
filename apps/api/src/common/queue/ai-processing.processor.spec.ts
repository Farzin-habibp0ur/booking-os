import { AiProcessingProcessor, AiProcessingJobData } from './ai-processing.processor';
import { Job } from 'bullmq';

describe('AiProcessingProcessor', () => {
  let processor: AiProcessingProcessor;

  beforeEach(() => {
    processor = new AiProcessingProcessor();
  });

  const createJob = (data: AiProcessingJobData, opts?: any): Job<AiProcessingJobData> =>
    ({ id: 'job-1', data, opts: opts || {}, attemptsMade: 0 }) as any;

  const mockModuleRef = (aiService: any, inboxGateway?: any) => {
    (processor as any).moduleRef = {
      get: jest.fn().mockImplementation((token: any, opts?: any) => {
        // Handle InboxGateway lookup (via getService helper)
        if (opts?.strict === false) return inboxGateway || null;
        return aiService;
      }),
    };
  };

  it('throws when AiService is not available', async () => {
    mockModuleRef(undefined);

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
    mockModuleRef({ processInboundMessage: mockProcess });

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
    mockModuleRef({ processInboundMessage: mockProcess });

    const job = createJob({
      businessId: 'biz1',
      conversationId: 'conv1',
      messageId: 'msg1',
      messageBody: 'hello',
    });

    await expect(processor.process(job)).rejects.toThrow('AI failed');
  });

  it('emits ai:processing event on start', async () => {
    const emitFn = jest.fn();
    const mockProcess = jest.fn().mockResolvedValue(undefined);
    mockModuleRef({ processInboundMessage: mockProcess }, { emitToBusinessRoom: emitFn });

    const job = createJob({
      businessId: 'biz1',
      conversationId: 'conv1',
      messageId: 'msg1',
      messageBody: 'hello',
    });

    await processor.process(job);

    expect(emitFn).toHaveBeenCalledWith('biz1', 'ai:processing', {
      conversationId: 'conv1',
      messageId: 'msg1',
    });
  });

  it('emits ai:draft-ready event on success', async () => {
    const emitFn = jest.fn();
    const mockProcess = jest.fn().mockResolvedValue(undefined);
    mockModuleRef({ processInboundMessage: mockProcess }, { emitToBusinessRoom: emitFn });

    const job = createJob({
      businessId: 'biz1',
      conversationId: 'conv1',
      messageId: 'msg1',
      messageBody: 'hello',
    });

    await processor.process(job);

    expect(emitFn).toHaveBeenCalledWith('biz1', 'ai:draft-ready', {
      conversationId: 'conv1',
      messageId: 'msg1',
    });
  });
});
