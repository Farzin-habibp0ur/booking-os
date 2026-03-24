import { AgentProcessingProcessor, AgentProcessingJobData } from './agent-processing.processor';
import { Job } from 'bullmq';

describe('AgentProcessingProcessor', () => {
  let processor: AgentProcessingProcessor;

  const mockTriggerAgent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new AgentProcessingProcessor();

    (processor as any).moduleRef = {
      get: jest.fn(() => ({
        triggerAgent: mockTriggerAgent,
      })),
    };
  });

  function createJob(data: Partial<AgentProcessingJobData> = {}): Job<AgentProcessingJobData> {
    return {
      id: 'job-1',
      data: {
        businessId: 'biz-1',
        agentType: 'WAITLIST',
        triggeredManually: false,
        ...data,
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any;
  }

  it('should trigger the agent and log success', async () => {
    mockTriggerAgent.mockResolvedValue({ cardsCreated: 3 });

    await processor.process(createJob());

    expect(mockTriggerAgent).toHaveBeenCalledWith('biz-1', 'WAITLIST');
  });

  it('should handle manual trigger flag', async () => {
    mockTriggerAgent.mockResolvedValue({ cardsCreated: 0 });

    await processor.process(createJob({ triggeredManually: true }));

    expect(mockTriggerAgent).toHaveBeenCalledWith('biz-1', 'WAITLIST');
  });

  it('should throw when agent framework fails', async () => {
    mockTriggerAgent.mockRejectedValue(new Error('Agent not registered'));

    await expect(processor.process(createJob())).rejects.toThrow('Agent not registered');
  });

  it('should handle different agent types', async () => {
    mockTriggerAgent.mockResolvedValue({ cardsCreated: 1 });

    await processor.process(createJob({ agentType: 'RETENTION' }));

    expect(mockTriggerAgent).toHaveBeenCalledWith('biz-1', 'RETENTION');
  });

  it('should throw when AgentFrameworkService is unavailable', async () => {
    (processor as any).moduleRef = { get: jest.fn(() => null) };

    await expect(processor.process(createJob())).rejects.toThrow(
      'AgentFrameworkService not available',
    );
  });

  it('should log on job failure', async () => {
    const logSpy = jest.spyOn(processor['logger'], 'warn').mockImplementation();
    const job = createJob();

    await processor.onFailed(job, new Error('timeout'));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent processing job job-1 failed'),
    );
  });
});
