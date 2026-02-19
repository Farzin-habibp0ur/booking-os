import { Test } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentFrameworkService } from './agent-framework.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('AgentController', () => {
  let controller: AgentController;
  let service: AgentFrameworkService;

  beforeEach(async () => {
    const prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [AgentFrameworkService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(AgentController);
    service = module.get(AgentFrameworkService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getConfigs to service', async () => {
    const spy = jest.spyOn(service, 'getConfigs').mockResolvedValue([]);
    const result = await controller.getConfigs('biz1');
    expect(spy).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([]);
  });

  it('delegates upsertConfig to service', async () => {
    const spy = jest.spyOn(service, 'upsertConfig').mockResolvedValue({ id: 'ac1' } as any);
    const result = await controller.upsertConfig('biz1', 'WAITLIST', { isEnabled: true });
    expect(spy).toHaveBeenCalledWith('biz1', 'WAITLIST', { isEnabled: true });
    expect(result).toEqual({ id: 'ac1' });
  });

  it('delegates triggerAgent to service', async () => {
    const spy = jest.spyOn(service, 'triggerAgent').mockResolvedValue({ id: 'run1' } as any);
    const result = await controller.triggerAgent('biz1', 'WAITLIST');
    expect(spy).toHaveBeenCalledWith('biz1', 'WAITLIST');
    expect(result).toEqual({ id: 'run1' });
  });

  it('delegates getRuns with parsed query params', async () => {
    const spy = jest.spyOn(service, 'getRuns').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    await controller.getRuns('biz1', { agentType: 'WAITLIST', page: '2', pageSize: '10' });
    expect(spy).toHaveBeenCalledWith('biz1', {
      agentType: 'WAITLIST',
      status: undefined,
      page: 2,
      pageSize: 10,
    });
  });

  it('delegates submitFeedback with staffId', async () => {
    const spy = jest.spyOn(service, 'submitFeedback').mockResolvedValue({ id: 'fb1' } as any);
    await controller.submitFeedback('biz1', 'staff1', {
      actionCardId: 'card1',
      rating: 'HELPFUL',
      comment: 'Nice',
    });
    expect(spy).toHaveBeenCalledWith('biz1', 'card1', 'staff1', 'HELPFUL', 'Nice');
  });

  it('delegates getFeedbackStats to service', async () => {
    const spy = jest.spyOn(service, 'getFeedbackStats').mockResolvedValue({
      helpful: 5,
      notHelpful: 1,
      total: 6,
      helpfulRate: 83,
    });
    const result = await controller.getFeedbackStats('biz1', 'WAITLIST');
    expect(spy).toHaveBeenCalledWith('biz1', 'WAITLIST');
    expect(result.helpfulRate).toBe(83);
  });

  it('returns registered agents', () => {
    const result = controller.getRegisteredAgents();
    expect(result).toEqual({ agents: [] });
  });
});
