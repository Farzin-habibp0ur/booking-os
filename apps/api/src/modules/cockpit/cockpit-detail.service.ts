import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { LinkedEntity } from './cockpit-tasks.schema';

export interface ResolvedEntity {
  type: string;
  id: string;
  label: string;
  status?: string;
  url?: string;
  details?: Record<string, unknown>;
}

export interface TaskDetailResponse {
  taskId: string;
  title: string;
  description: string;
  resolvedEntities: ResolvedEntity[];
}

@Injectable()
export class CockpitDetailService {
  private readonly logger = new Logger(CockpitDetailService.name);

  constructor(private prisma: PrismaService) {}

  async getDailyTaskDetail(
    businessId: string,
    taskId: string,
    linkedEntities: LinkedEntity[],
    title: string,
    description: string,
  ): Promise<TaskDetailResponse> {
    const resolvedEntities = await Promise.all(
      linkedEntities.map((entity) => this.resolveEntity(businessId, entity)),
    );

    return {
      taskId,
      title,
      description,
      resolvedEntities: resolvedEntities.filter((e): e is ResolvedEntity => e !== null),
    };
  }

  private async resolveEntity(
    businessId: string,
    entity: LinkedEntity,
  ): Promise<ResolvedEntity | null> {
    try {
      switch (entity.type) {
        case 'PERSON':
          return this.resolvePersonEntity(businessId, entity);
        case 'JIRA_ISSUE':
          return this.resolveJiraEntity(entity);
        case 'SLACK_THREAD':
          return this.resolveSlackEntity(entity);
        case 'EMAIL':
          return this.resolveEmailEntity(entity);
        case 'MEETING':
          return this.resolveMeetingEntity(entity);
        case 'COMMITMENT':
          return this.resolveCommitmentEntity(entity);
        case 'DRIFT_ALERT':
          return this.resolveDriftAlertEntity(businessId, entity);
        case 'ROCK':
          return this.resolveRockEntity(entity);
        case 'DOCUMENT':
          return this.resolveDocumentEntity(entity);
        default:
          return {
            type: entity.type,
            id: entity.id,
            label: entity.label,
            status: entity.status,
          };
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve entity ${entity.type}:${entity.id}: ${(err as Error).message}`);
      return {
        type: entity.type,
        id: entity.id,
        label: entity.label,
        status: entity.status,
      };
    }
  }

  private async resolvePersonEntity(
    businessId: string,
    entity: LinkedEntity,
  ): Promise<ResolvedEntity> {
    // Try to find as staff member
    const staff = await this.prisma.staff.findFirst({
      where: { businessId, id: entity.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (staff) {
      return {
        type: 'PERSON',
        id: staff.id,
        label: staff.name,
        status: staff.role,
        details: { email: staff.email, role: staff.role },
      };
    }

    // Try customer
    const customer = await this.prisma.customer.findFirst({
      where: { businessId, id: entity.id },
      select: { id: true, name: true, email: true, phone: true },
    });

    if (customer) {
      return {
        type: 'PERSON',
        id: customer.id,
        label: customer.name,
        status: 'Customer',
        details: { email: customer.email, phone: customer.phone },
      };
    }

    return { type: 'PERSON', id: entity.id, label: entity.label, status: entity.status };
  }

  private resolveJiraEntity(entity: LinkedEntity): ResolvedEntity {
    // Jira keys are external — construct URL if it looks like a key
    const jiraKey = entity.id;
    return {
      type: 'JIRA_ISSUE',
      id: jiraKey,
      label: entity.label,
      status: entity.status,
      // URL would be constructed from a configured Jira base URL
      // For now, leave as the key for the frontend to handle
      url: undefined,
    };
  }

  private resolveSlackEntity(entity: LinkedEntity): ResolvedEntity {
    return {
      type: 'SLACK_THREAD',
      id: entity.id,
      label: entity.label,
      status: entity.status,
      url: entity.id.startsWith('http') ? entity.id : undefined,
    };
  }

  private resolveEmailEntity(entity: LinkedEntity): ResolvedEntity {
    return {
      type: 'EMAIL',
      id: entity.id,
      label: entity.label,
      status: entity.status,
      url: entity.id.startsWith('http') ? entity.id : undefined,
    };
  }

  private resolveMeetingEntity(entity: LinkedEntity): ResolvedEntity {
    return {
      type: 'MEETING',
      id: entity.id,
      label: entity.label,
      status: entity.status,
    };
  }

  private resolveCommitmentEntity(entity: LinkedEntity): ResolvedEntity {
    return {
      type: 'COMMITMENT',
      id: entity.id,
      label: entity.label,
      status: entity.status,
    };
  }

  private async resolveDriftAlertEntity(
    businessId: string,
    entity: LinkedEntity,
  ): Promise<ResolvedEntity> {
    // Try to resolve as an escalation event
    const escalation = await this.prisma.escalationEvent.findFirst({
      where: { businessId, id: entity.id },
    });

    if (escalation) {
      return {
        type: 'DRIFT_ALERT',
        id: escalation.id,
        label: escalation.title,
        status: escalation.isResolved ? 'Resolved' : `${escalation.severity} — Unresolved`,
        details: {
          triggerType: escalation.triggerType,
          severity: escalation.severity,
          description: escalation.description,
        },
      };
    }

    return { type: 'DRIFT_ALERT', id: entity.id, label: entity.label, status: entity.status };
  }

  private resolveRockEntity(entity: LinkedEntity): ResolvedEntity {
    return {
      type: 'ROCK',
      id: entity.id,
      label: entity.label,
      status: entity.status,
    };
  }

  private resolveDocumentEntity(entity: LinkedEntity): ResolvedEntity {
    return {
      type: 'DOCUMENT',
      id: entity.id,
      label: entity.label,
      status: entity.status,
      url: entity.id.startsWith('http') ? entity.id : undefined,
    };
  }
}
