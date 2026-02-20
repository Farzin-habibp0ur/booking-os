import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
  latencyMs?: number;
}

@Injectable()
export class ConsoleHealthService {
  private readonly logger = new Logger(ConsoleHealthService.name);

  constructor(private prisma: PrismaService) {}

  async getHealth() {
    const checks: HealthCheck[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Database connectivity
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);

    // Business activity
    const activityCheck = await this.checkBusinessActivity(sevenDaysAgo);
    checks.push(activityCheck);

    // Agent health
    const agentCheck = await this.checkAgentHealth(sevenDaysAgo);
    checks.push(agentCheck);

    // Calendar sync health
    const calendarCheck = await this.checkCalendarSyncHealth();
    checks.push(calendarCheck);

    // Message delivery
    const messageCheck = await this.checkMessageDelivery(sevenDaysAgo);
    checks.push(messageCheck);

    // Overall status
    const hasDown = checks.some((c) => c.status === 'down');
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    const overallStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';

    // Business health distribution
    const healthDistribution = await this.getBusinessHealthDistribution();

    return {
      status: overallStatus,
      checks,
      businessHealth: healthDistribution,
      checkedAt: now.toISOString(),
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return {
        name: 'Database',
        status: latencyMs > 1000 ? 'degraded' : 'healthy',
        message: `Response time: ${latencyMs}ms`,
        latencyMs,
      };
    } catch (error) {
      return { name: 'Database', status: 'down', message: 'Connection failed' };
    }
  }

  private async checkBusinessActivity(since: Date): Promise<HealthCheck> {
    const [totalBiz, activeBiz] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.business.count({
        where: { bookings: { some: { createdAt: { gte: since } } } },
      }),
    ]);

    const ratio = totalBiz > 0 ? activeBiz / totalBiz : 0;
    const status = ratio >= 0.5 ? 'healthy' : ratio >= 0.25 ? 'degraded' : 'down';

    return {
      name: 'Business Activity',
      status,
      message: `${activeBiz}/${totalBiz} businesses active in last 7 days`,
    };
  }

  private async checkAgentHealth(since: Date): Promise<HealthCheck> {
    const [totalRuns, failedRuns] = await Promise.all([
      this.prisma.agentRun.count({ where: { startedAt: { gte: since } } }),
      this.prisma.agentRun.count({
        where: { startedAt: { gte: since }, status: 'FAILED' },
      }),
    ]);

    if (totalRuns === 0) {
      return { name: 'AI Agents', status: 'healthy', message: 'No runs in last 7 days' };
    }

    const failRate = failedRuns / totalRuns;
    const status = failRate <= 0.05 ? 'healthy' : failRate <= 0.2 ? 'degraded' : 'down';

    return {
      name: 'AI Agents',
      status,
      message: `${failedRuns}/${totalRuns} runs failed (${(failRate * 100).toFixed(1)}%)`,
    };
  }

  private async checkCalendarSyncHealth(): Promise<HealthCheck> {
    const [totalConnections, errorConnections] = await Promise.all([
      this.prisma.calendarConnection.count({ where: { syncEnabled: true } }),
      this.prisma.calendarConnection.count({
        where: { syncEnabled: true, lastSyncError: { not: null } },
      }),
    ]);

    if (totalConnections === 0) {
      return { name: 'Calendar Sync', status: 'healthy', message: 'No active connections' };
    }

    const errorRate = errorConnections / totalConnections;
    const status = errorRate <= 0.1 ? 'healthy' : errorRate <= 0.3 ? 'degraded' : 'down';

    return {
      name: 'Calendar Sync',
      status,
      message: `${errorConnections}/${totalConnections} connections have errors`,
    };
  }

  private async checkMessageDelivery(since: Date): Promise<HealthCheck> {
    const [totalMessages, failedMessages] = await Promise.all([
      this.prisma.message.count({ where: { createdAt: { gte: since }, direction: 'OUTBOUND' } }),
      this.prisma.message.count({
        where: { createdAt: { gte: since }, direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
      }),
    ]);

    if (totalMessages === 0) {
      return { name: 'Message Delivery', status: 'healthy', message: 'No outbound messages' };
    }

    const failRate = failedMessages / totalMessages;
    const status = failRate <= 0.02 ? 'healthy' : failRate <= 0.1 ? 'degraded' : 'down';

    return {
      name: 'Message Delivery',
      status,
      message: `${failedMessages}/${totalMessages} messages failed (${(failRate * 100).toFixed(1)}%)`,
    };
  }

  private async getBusinessHealthDistribution() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const businesses = await this.prisma.business.findMany({
      select: {
        id: true,
        subscription: { select: { status: true } },
        bookings: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let green = 0;
    let yellow = 0;
    let red = 0;

    for (const biz of businesses) {
      const billingStatus = biz.subscription?.status || null;
      const lastActive = biz.bookings[0]?.createdAt || null;

      if (billingStatus === 'canceled') {
        red++;
      } else if (!lastActive || lastActive < thirtyDaysAgo) {
        red++;
      } else if (billingStatus === 'past_due') {
        yellow++;
      } else if (lastActive < sevenDaysAgo) {
        yellow++;
      } else {
        green++;
      }
    }

    return { green, yellow, red, total: businesses.length };
  }
}
