import { Test } from '@nestjs/testing';
import { CockpitController } from './cockpit.controller';
import { CockpitTasksService } from './cockpit-tasks.service';
import { CockpitDetailService } from './cockpit-detail.service';

function createMockTasksService() {
  return {
    generateDailyTasks: jest.fn().mockResolvedValue({
      tasks: [
        {
          id: 'ct-1',
          title: 'Test task',
          description: 'A test task',
          priority: 'URGENT_TODAY',
          category: 'TEST',
          actionItems: [{ label: 'Do something' }],
          linkedEntities: [],
          qualityFlag: 'SPECIFIC',
        },
      ],
      generatedAt: '2026-03-17T10:00:00Z',
      businessId: 'biz1',
    }),
  };
}

function createMockDetailService() {
  return {
    getDailyTaskDetail: jest.fn().mockResolvedValue({
      taskId: 'ct-1',
      title: 'Test task',
      description: 'A test task',
      resolvedEntities: [],
    }),
  };
}

describe('CockpitController', () => {
  let controller: CockpitController;
  let tasksService: ReturnType<typeof createMockTasksService>;
  let detailService: ReturnType<typeof createMockDetailService>;

  beforeEach(async () => {
    tasksService = createMockTasksService();
    detailService = createMockDetailService();

    const module = await Test.createTestingModule({
      controllers: [CockpitController],
      providers: [
        { provide: CockpitTasksService, useValue: tasksService },
        { provide: CockpitDetailService, useValue: detailService },
      ],
    }).compile();

    controller = module.get(CockpitController);
  });

  describe('getDailyTasks', () => {
    it('calls service with businessId', async () => {
      const result = await controller.getDailyTasks('biz1');

      expect(tasksService.generateDailyTasks).toHaveBeenCalledWith('biz1');
      expect(result.tasks).toHaveLength(1);
      expect(result.businessId).toBe('biz1');
    });
  });

  describe('getTaskDetail', () => {
    it('calls detail service with body params', async () => {
      const body = {
        linkedEntities: [{ type: 'JIRA_ISSUE', id: 'PROJ-1', label: 'Issue' }],
        title: 'Test',
        description: 'Desc',
      };

      await controller.getTaskDetail('biz1', 'ct-1', body);

      expect(detailService.getDailyTaskDetail).toHaveBeenCalledWith(
        'biz1',
        'ct-1',
        body.linkedEntities,
        'Test',
        'Desc',
      );
    });
  });
});
