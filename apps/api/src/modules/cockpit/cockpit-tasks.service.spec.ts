import { Test } from '@nestjs/testing';
import { CockpitTasksService } from './cockpit-tasks.service';
import { PrismaService } from '../../common/prisma.service';
import { ClaudeClient } from '../ai/claude.client';
import { CockpitTasksContextService } from './cockpit-tasks-context.service';
import { createMockPrisma, createMockClaudeClient } from '../../test/mocks';

function createMockContextService() {
  return {
    buildContext: jest.fn().mockResolvedValue({
      sections: [{ label: 'Test', content: 'test context' }],
      generatedAt: new Date().toISOString(),
    }),
    formatContextForPrompt: jest.fn().mockReturnValue('## Section 1: Test\ntest context'),
  };
}

const VALID_AI_RESPONSE = JSON.stringify({
  tasks: [
    {
      title: 'Unblock PROJ-234: Sarah needs API credentials',
      description: 'PROJ-234 stuck for 3 days, Sarah waiting on DevOps.',
      priority: 'URGENT_TODAY',
      category: 'STALLED_WORK',
      actionItems: [
        {
          label: 'Message Sarah about PROJ-234 status',
          entityType: 'JIRA_ISSUE',
          entityId: 'PROJ-234',
          entityLabel: 'API credentials setup',
        },
      ],
      linkedEntities: [
        { type: 'JIRA_ISSUE', id: 'PROJ-234', label: 'API credentials', status: 'In Progress' },
        { type: 'PERSON', id: 'staff-sarah', label: 'Sarah' },
      ],
    },
  ],
  generatedAt: '2026-03-17T10:00:00Z',
});

const VAGUE_AI_RESPONSE = JSON.stringify({
  tasks: [
    {
      title: 'Review pending items',
      description: 'There are some items to review.',
      priority: 'HYGIENE',
      category: 'GENERAL',
      actionItems: [{ label: 'Check things' }],
      linkedEntities: [],
    },
    {
      title: 'Follow up on tasks',
      description: 'Some tasks need follow up.',
      priority: 'OPPORTUNITY',
      category: 'GENERAL',
      actionItems: [{ label: 'Follow up' }],
      linkedEntities: [],
    },
  ],
  generatedAt: '2026-03-17T10:00:00Z',
});

describe('CockpitTasksService', () => {
  let service: CockpitTasksService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let claudeClient: ReturnType<typeof createMockClaudeClient>;
  let contextService: ReturnType<typeof createMockContextService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    claudeClient = createMockClaudeClient();
    contextService = createMockContextService();

    const module = await Test.createTestingModule({
      providers: [
        CockpitTasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClaudeClient, useValue: claudeClient },
        { provide: CockpitTasksContextService, useValue: contextService },
      ],
    }).compile();

    service = module.get(CockpitTasksService);
  });

  describe('generateDailyTasks', () => {
    it('returns empty tasks when Claude is unavailable', async () => {
      claudeClient.isAvailable.mockReturnValue(false);

      const result = await service.generateDailyTasks('biz1');

      expect(result.tasks).toHaveLength(0);
      expect(result.businessId).toBe('biz1');
    });

    it('generates tasks from AI response', async () => {
      claudeClient.complete.mockResolvedValue(VALID_AI_RESPONSE);

      const result = await service.generateDailyTasks('biz1');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toContain('PROJ-234');
      expect(result.tasks[0].actionItems).toHaveLength(1);
      expect(result.tasks[0].linkedEntities).toHaveLength(2);
      expect(result.tasks[0].id).toBeDefined();
    });

    it('builds context before calling AI', async () => {
      claudeClient.complete.mockResolvedValue(VALID_AI_RESPONSE);

      await service.generateDailyTasks('biz1');

      expect(contextService.buildContext).toHaveBeenCalledWith('biz1');
      expect(contextService.formatContextForPrompt).toHaveBeenCalled();
      expect(claudeClient.complete).toHaveBeenCalledWith(
        'sonnet',
        expect.any(String),
        expect.any(Array),
        4096,
      );
    });

    it('flags specific tasks as SPECIFIC', async () => {
      claudeClient.complete.mockResolvedValue(VALID_AI_RESPONSE);

      const result = await service.generateDailyTasks('biz1');

      expect(result.tasks[0].qualityFlag).toBe('SPECIFIC');
    });

    it('flags vague tasks as VAGUE', async () => {
      claudeClient.complete.mockResolvedValue(VAGUE_AI_RESPONSE);

      const result = await service.generateDailyTasks('biz1');

      // All tasks are vague, so it triggers retry
      // After retry also returns vague (same mock), all flagged VAGUE
      for (const task of result.tasks) {
        expect(task.qualityFlag).toBe('VAGUE');
      }
    });

    it('retries when >50% tasks are vague', async () => {
      claudeClient.complete
        .mockResolvedValueOnce(VAGUE_AI_RESPONSE) // first attempt
        .mockResolvedValueOnce(VALID_AI_RESPONSE); // retry

      const result = await service.generateDailyTasks('biz1');

      expect(claudeClient.complete).toHaveBeenCalledTimes(2);
      // Retry response has specific tasks
      expect(result.tasks[0].title).toContain('PROJ-234');
    });

    it('handles unparseable AI response', async () => {
      claudeClient.complete.mockResolvedValue('not json at all');

      const result = await service.generateDailyTasks('biz1');

      expect(result.tasks).toHaveLength(0);
    });

    it('handles AI error gracefully', async () => {
      claudeClient.complete.mockRejectedValue(new Error('API rate limited'));

      await expect(service.generateDailyTasks('biz1')).rejects.toThrow('API rate limited');
    });

    it('assigns unique IDs to each task', async () => {
      const multiTaskResponse = JSON.stringify({
        tasks: [
          {
            title: 'Task A with PROJ-100',
            description: 'Details about PROJ-100.',
            priority: 'URGENT_TODAY',
            category: 'STALLED_WORK',
            actionItems: [{ label: 'Do A', entityType: 'JIRA_ISSUE', entityId: 'PROJ-100' }],
            linkedEntities: [{ type: 'JIRA_ISSUE', id: 'PROJ-100', label: 'Task A' }],
          },
          {
            title: 'Task B with PROJ-200',
            description: 'Details about PROJ-200.',
            priority: 'NEEDS_APPROVAL',
            category: 'PENDING_APPROVAL',
            actionItems: [{ label: 'Do B', entityType: 'JIRA_ISSUE', entityId: 'PROJ-200' }],
            linkedEntities: [{ type: 'JIRA_ISSUE', id: 'PROJ-200', label: 'Task B' }],
          },
        ],
        generatedAt: '2026-03-17T10:00:00Z',
      });
      claudeClient.complete.mockResolvedValue(multiTaskResponse);

      const result = await service.generateDailyTasks('biz1');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).not.toBe(result.tasks[1].id);
    });
  });

  describe('validateTaskSpecificity', () => {
    it('marks task with Jira keys and names as SPECIFIC', () => {
      const result = service.validateTaskSpecificity({
        title: 'Unblock PROJ-234: Sarah needs credentials',
        description: 'PROJ-234 is stuck for 3 days.',
        priority: 'URGENT_TODAY',
        category: 'STALLED_WORK',
        actionItems: [{ label: 'Ping Sarah', entityType: 'JIRA_ISSUE', entityId: 'PROJ-234' }],
        linkedEntities: [
          { type: 'JIRA_ISSUE', id: 'PROJ-234', label: 'API setup', status: 'In Progress' },
        ],
      });
      expect(result).toBe('SPECIFIC');
    });

    it('marks generic task as VAGUE', () => {
      const result = service.validateTaskSpecificity({
        title: 'review pending items',
        description: 'there are items to review.',
        priority: 'HYGIENE',
        category: 'GENERAL',
        actionItems: [{ label: 'check things' }],
        linkedEntities: [],
      });
      expect(result).toBe('VAGUE');
    });

    it('marks task with no actionItems as VAGUE', () => {
      const result = service.validateTaskSpecificity({
        title: 'PROJ-100 is blocked',
        description: 'Needs attention from Sarah.',
        priority: 'URGENT_TODAY',
        category: 'STALLED_WORK',
        actionItems: [],
        linkedEntities: [],
      });
      expect(result).toBe('VAGUE');
    });
  });
});
