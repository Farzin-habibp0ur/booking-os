import { Test } from '@nestjs/testing';
import { AgentSchedulerService } from './agent-scheduler.service';
import { AgentFrameworkService } from './agent-framework.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('AgentSchedulerService', () => {
  let scheduler: AgentSchedulerService;
  let framework: AgentFrameworkService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        AgentSchedulerService,
        AgentFrameworkService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    scheduler = module.get(AgentSchedulerService);
    framework = module.get(AgentFrameworkService);
  });

  it('skips when no enabled configs', async () => {
    prisma.agentConfig.findMany.mockResolvedValue([]);

    await scheduler.runScheduledAgents();

    expect(prisma.agentConfig.findMany).toHaveBeenCalledWith({
      where: { isEnabled: true },
      orderBy: { agentType: 'asc' },
    });
  });

  it('skips agents with no registered handler', async () => {
    prisma.agentConfig.findMany.mockResolvedValue([
      { id: 'ac1', businessId: 'biz1', agentType: 'UNKNOWN', isEnabled: true },
    ] as any);

    await scheduler.runScheduledAgents();

    expect(prisma.agentRun.create).not.toHaveBeenCalled();
  });

  it('skips agents that ran recently', async () => {
    const mockAgent = {
      agentType: 'WAITLIST',
      execute: jest.fn().mockResolvedValue({ cardsCreated: 0 }),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    framework.registerAgent(mockAgent);

    prisma.agentConfig.findMany.mockResolvedValue([
      { id: 'ac1', businessId: 'biz1', agentType: 'WAITLIST', isEnabled: true },
    ] as any);
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run1',
      startedAt: new Date(),
    } as any);

    await scheduler.runScheduledAgents();

    expect(prisma.agentRun.create).not.toHaveBeenCalled();
  });

  it('triggers agent when no recent run', async () => {
    const mockAgent = {
      agentType: 'WAITLIST',
      execute: jest.fn().mockResolvedValue({ cardsCreated: 2 }),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    framework.registerAgent(mockAgent);

    prisma.agentConfig.findMany.mockResolvedValue([
      { id: 'ac1', businessId: 'biz1', agentType: 'WAITLIST', isEnabled: true, config: {} },
    ] as any);
    prisma.agentRun.findFirst.mockResolvedValue(null);
    // triggerAgent will call findUnique for config check
    prisma.agentConfig.findUnique.mockResolvedValue({
      id: 'ac1',
      isEnabled: true,
      config: {},
    } as any);
    prisma.agentRun.create.mockResolvedValue({ id: 'run1', status: 'RUNNING' } as any);
    prisma.agentRun.update.mockResolvedValue({
      id: 'run1',
      status: 'COMPLETED',
      cardsCreated: 2,
    } as any);

    await scheduler.runScheduledAgents();

    expect(mockAgent.execute).toHaveBeenCalledWith('biz1', {});
  });

  it('handles agent execution error gracefully', async () => {
    const mockAgent = {
      agentType: 'RETENTION',
      execute: jest.fn().mockRejectedValue(new Error('DB timeout')),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    framework.registerAgent(mockAgent);

    prisma.agentConfig.findMany.mockResolvedValue([
      { id: 'ac2', businessId: 'biz1', agentType: 'RETENTION', isEnabled: true, config: {} },
    ] as any);
    prisma.agentRun.findFirst.mockResolvedValue(null);
    prisma.agentConfig.findUnique.mockResolvedValue({
      id: 'ac2',
      isEnabled: true,
      config: {},
    } as any);
    prisma.agentRun.create.mockResolvedValue({ id: 'run2', status: 'RUNNING' } as any);
    prisma.agentRun.update.mockResolvedValue({
      id: 'run2',
      status: 'FAILED',
      error: 'DB timeout',
    } as any);

    // Should not throw
    await scheduler.runScheduledAgents();

    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', error: 'DB timeout' }),
      }),
    );
  });

  it('prevents concurrent execution', async () => {
    prisma.agentConfig.findMany.mockImplementation(
      (() => new Promise((resolve) => setTimeout(() => resolve([]), 100))) as any,
    );

    const run1 = scheduler.runScheduledAgents();
    const run2 = scheduler.runScheduledAgents();

    await Promise.all([run1, run2]);

    // Only one call should have been made since the second should skip
    expect(prisma.agentConfig.findMany).toHaveBeenCalledTimes(1);
  });

  it('processes multiple agents in sequence', async () => {
    const waitlistAgent = {
      agentType: 'WAITLIST',
      execute: jest.fn().mockResolvedValue({ cardsCreated: 1 }),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    const retentionAgent = {
      agentType: 'RETENTION',
      execute: jest.fn().mockResolvedValue({ cardsCreated: 2 }),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    framework.registerAgent(waitlistAgent);
    framework.registerAgent(retentionAgent);

    prisma.agentConfig.findMany.mockResolvedValue([
      { id: 'ac1', businessId: 'biz1', agentType: 'WAITLIST', isEnabled: true, config: {} },
      { id: 'ac2', businessId: 'biz1', agentType: 'RETENTION', isEnabled: true, config: {} },
    ] as any);
    prisma.agentRun.findFirst.mockResolvedValue(null);
    prisma.agentConfig.findUnique.mockResolvedValue({
      id: 'ac1',
      isEnabled: true,
      config: {},
    } as any);
    prisma.agentRun.create.mockResolvedValue({ id: 'run1', status: 'RUNNING' } as any);
    prisma.agentRun.update.mockResolvedValue({ id: 'run1', status: 'COMPLETED' } as any);

    await scheduler.runScheduledAgents();

    expect(waitlistAgent.execute).toHaveBeenCalled();
    expect(retentionAgent.execute).toHaveBeenCalled();
  });
});
