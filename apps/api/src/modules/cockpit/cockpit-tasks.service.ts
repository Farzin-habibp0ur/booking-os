import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ClaudeClient } from '../ai/claude.client';
import { CockpitTasksContextService } from './cockpit-tasks-context.service';
import {
  DAILY_TASKS_SYSTEM_PROMPT,
  buildDailyTasksUserPrompt,
} from './cockpit-tasks.prompt';
import {
  CockpitTaskSchema,
  CockpitTasksOutput,
  validateCockpitTasksOutput,
} from './cockpit-tasks.schema';

export interface GeneratedDailyTasks {
  tasks: (CockpitTaskSchema & { id: string })[];
  generatedAt: string;
  businessId: string;
}

// Regex patterns for detecting specificity in task text
const JIRA_KEY_REGEX = /[A-Z]{2,10}-\d+/;
const PROPER_NOUN_REGEX = /[A-Z][a-z]{2,}/;
const ID_REGEX = /\b(cl[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4})/;

@Injectable()
export class CockpitTasksService {
  private readonly logger = new Logger(CockpitTasksService.name);

  constructor(
    private prisma: PrismaService,
    private claudeClient: ClaudeClient,
    private contextService: CockpitTasksContextService,
  ) {}

  async generateDailyTasks(businessId: string): Promise<GeneratedDailyTasks> {
    if (!this.claudeClient.isAvailable()) {
      this.logger.warn('Claude client unavailable — returning empty tasks');
      return { tasks: [], generatedAt: new Date().toISOString(), businessId };
    }

    const context = await this.contextService.buildContext(businessId);
    const contextText = this.contextService.formatContextForPrompt(context);

    const rawResponse = await this.claudeClient.complete(
      'sonnet',
      DAILY_TASKS_SYSTEM_PROMPT,
      [{ role: 'user', content: buildDailyTasksUserPrompt(contextText) }],
      4096,
    );

    let parsed: CockpitTasksOutput | null = null;
    try {
      const json = JSON.parse(rawResponse);
      parsed = validateCockpitTasksOutput(json);
    } catch (err) {
      this.logger.error(`Failed to parse cockpit tasks JSON: ${(err as Error).message}`);
    }

    if (!parsed) {
      this.logger.warn('AI returned unparseable tasks output');
      return { tasks: [], generatedAt: new Date().toISOString(), businessId };
    }

    // Validation pass — flag vague tasks
    let tasks = parsed.tasks.map((t) => ({
      ...t,
      id: this.generateTaskId(),
      qualityFlag: this.assessSpecificity(t),
    }));

    // If >50% vague, retry once with explicit instruction
    const vagueCount = tasks.filter((t) => t.qualityFlag === 'VAGUE').length;
    if (vagueCount > tasks.length / 2 && tasks.length > 0) {
      this.logger.warn(
        `${vagueCount}/${tasks.length} tasks flagged VAGUE — retrying with stricter prompt`,
      );
      const retryTasks = await this.retryWithStricterPrompt(contextText);
      if (retryTasks && retryTasks.tasks.length > 0) {
        tasks = retryTasks.tasks.map((t) => ({
          ...t,
          id: this.generateTaskId(),
          qualityFlag: this.assessSpecificity(t),
        }));
      }
    }

    return {
      tasks,
      generatedAt: parsed.generatedAt,
      businessId,
    };
  }

  validateTaskSpecificity(task: CockpitTaskSchema): 'SPECIFIC' | 'VAGUE' {
    return this.assessSpecificity(task);
  }

  private assessSpecificity(task: CockpitTaskSchema): 'SPECIFIC' | 'VAGUE' {
    let specificityScore = 0;

    // Check title for specifics
    const titleAndDesc = `${task.title} ${task.description}`;
    if (JIRA_KEY_REGEX.test(titleAndDesc)) specificityScore += 2;
    if (PROPER_NOUN_REGEX.test(titleAndDesc)) specificityScore += 1;
    if (ID_REGEX.test(titleAndDesc)) specificityScore += 1;

    // Check action items for entity references
    for (const item of task.actionItems) {
      if (item.entityId) specificityScore += 1;
      if (item.entityType) specificityScore += 1;
      if (JIRA_KEY_REGEX.test(item.label)) specificityScore += 1;
      if (PROPER_NOUN_REGEX.test(item.label)) specificityScore += 1;
    }

    // Check linked entities
    if (task.linkedEntities.length > 0) specificityScore += 1;
    for (const entity of task.linkedEntities) {
      if (entity.status) specificityScore += 1;
    }

    // Non-empty actionItems is required by schema validation,
    // but double-check here
    if (task.actionItems.length === 0) return 'VAGUE';

    // Need at least score of 3 to be considered specific
    return specificityScore >= 3 ? 'SPECIFIC' : 'VAGUE';
  }

  private async retryWithStricterPrompt(contextText: string): Promise<CockpitTasksOutput | null> {
    const stricterInstruction = `IMPORTANT: Your previous attempt produced vague tasks. This time you MUST:
1. Include specific Jira keys, people names, and entity IDs from the context in EVERY task title
2. Every actionItem label must reference a specific entity by name or ID
3. Every task must have at least one linkedEntity with a real ID from the context
4. Never use generic phrases like "Review items", "Follow up on things", "Address concerns"

${buildDailyTasksUserPrompt(contextText)}`;

    try {
      const rawResponse = await this.claudeClient.complete(
        'sonnet',
        DAILY_TASKS_SYSTEM_PROMPT,
        [{ role: 'user', content: stricterInstruction }],
        4096,
      );

      const json = JSON.parse(rawResponse);
      return validateCockpitTasksOutput(json);
    } catch (err) {
      this.logger.error(`Retry also failed: ${(err as Error).message}`);
      return null;
    }
  }

  private generateTaskId(): string {
    return `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
