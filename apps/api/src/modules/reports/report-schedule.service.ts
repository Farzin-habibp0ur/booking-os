import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from './reports.service';
import { EmailService } from '../email/email.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { UpdateReportScheduleDto } from './dto/update-report-schedule.dto';

@Injectable()
export class ReportScheduleService {
  private readonly logger = new Logger(ReportScheduleService.name);

  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private emailService: EmailService,
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue?: Queue,
  ) {}

  async create(businessId: string, dto: CreateReportScheduleDto) {
    return this.prisma.reportSchedule.create({
      data: {
        businessId,
        reportType: dto.reportType,
        frequency: dto.frequency,
        recipients: dto.recipients,
        dayOfWeek: dto.dayOfWeek,
        dayOfMonth: dto.dayOfMonth,
        hour: dto.hour ?? 9,
        timezone: dto.timezone ?? 'UTC',
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.reportSchedule.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(businessId: string, id: string, dto: UpdateReportScheduleDto) {
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: { id, businessId },
    });
    if (!schedule) throw new NotFoundException('Report schedule not found');

    return this.prisma.reportSchedule.update({
      where: { id },
      data: dto,
    });
  }

  async remove(businessId: string, id: string) {
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: { id, businessId },
    });
    if (!schedule) throw new NotFoundException('Report schedule not found');

    return this.prisma.reportSchedule.delete({ where: { id } });
  }

  async findDueSchedules(): Promise<any[]> {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDay = now.getUTCDay();
    const currentDate = now.getUTCDate();

    const schedules = await this.prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        hour: currentHour,
      },
      include: { business: { select: { name: true } } },
    });

    return schedules.filter((s) => {
      // Skip if already sent this hour
      if (s.lastSentAt) {
        const hoursSince = (now.getTime() - s.lastSentAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 1) return false;
      }

      switch (s.frequency) {
        case 'DAILY':
          return true;
        case 'WEEKLY':
          return s.dayOfWeek === currentDay;
        case 'MONTHLY':
          return s.dayOfMonth === currentDate;
        default:
          return false;
      }
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledReports() {
    const due = await this.findDueSchedules();
    if (due.length === 0) return;

    this.logger.log(`Found ${due.length} due report schedules`);

    for (const schedule of due) {
      try {
        if (this.notificationQueue) {
          await this.notificationQueue.add('report-email', {
            scheduleId: schedule.id,
            businessId: schedule.businessId,
            reportType: schedule.reportType,
            recipients: schedule.recipients,
            businessName: schedule.business.name,
          });
        } else {
          await this.sendReportEmail(schedule);
        }
      } catch (err) {
        this.logger.error(`Failed to enqueue report ${schedule.id}: ${(err as Error).message}`);
      }
    }
  }

  async sendReportEmail(schedule: {
    id: string;
    businessId: string;
    reportType: string;
    recipients: string[];
    business: { name: string };
  }) {
    const reportData = await this.getReportData(schedule.businessId, schedule.reportType);
    const html = this.buildReportHtml(schedule.reportType, schedule.business.name, reportData);

    for (const recipient of schedule.recipients) {
      await this.emailService.send({
        to: recipient,
        subject: `${this.formatReportName(schedule.reportType)} Report — ${schedule.business.name}`,
        html: this.emailService.buildBrandedHtml(html),
      });
    }

    await this.prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastSentAt: new Date() },
    });
  }

  private async getReportData(businessId: string, reportType: string): Promise<any> {
    const methodMap: Record<string, (bid: string, days?: number) => Promise<any>> = {
      'bookings-over-time': (bid, d) => this.reportsService.bookingsOverTime(bid, d),
      'revenue-over-time': (bid, d) => this.reportsService.revenueOverTime(bid, d),
      'no-show-rate': (bid, d) => this.reportsService.noShowRate(bid, d),
      'service-breakdown': (bid, d) => this.reportsService.serviceBreakdown(bid, d),
      'staff-performance': (bid, d) => this.reportsService.staffPerformance(bid, d),
      'status-breakdown': (bid, d) => this.reportsService.statusBreakdown(bid, d),
      'peak-hours': (bid, d) => this.reportsService.peakHours(bid, d),
      'consult-conversion': (bid, d) => this.reportsService.consultToTreatmentConversion(bid, d),
    };

    const method = methodMap[reportType];
    if (!method) return { error: 'Unknown report type' };
    return method(businessId, 30);
  }

  private formatReportName(type: string): string {
    return type
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private buildReportHtml(reportType: string, businessName: string, data: any): string {
    const reportName = this.formatReportName(reportType);
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let dataRows = '';

    if (Array.isArray(data)) {
      // Table-like data (bookings-over-time, revenue, service, staff, status)
      if (data.length === 0) {
        dataRows = '<p style="color:#94A3B8;">No data available for this period.</p>';
      } else {
        const keys = Object.keys(data[0]);
        dataRows = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
<tr>${keys.map((k) => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #E4EBE6;font-size:12px;text-transform:uppercase;color:#64748B;">${k}</th>`).join('')}</tr>
${data
  .slice(0, 20)
  .map(
    (row: any) =>
      `<tr>${keys.map((k) => `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;">${row[k]}</td>`).join('')}</tr>`,
  )
  .join('')}
</table>`;
        if (data.length > 20) {
          dataRows += `<p style="font-size:12px;color:#94A3B8;margin-top:8px;">Showing 20 of ${data.length} rows</p>`;
        }
      }
    } else if (data && typeof data === 'object') {
      // Key-value data (no-show-rate, consult-conversion, response-times, peak-hours)
      const entries = Object.entries(data).filter(([k]) => !k.startsWith('_'));
      dataRows = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
${entries.map(([k, v]) => `<tr><td style="padding:8px 12px;font-size:14px;color:#64748B;">${this.formatReportName(k)}</td><td style="padding:8px 12px;font-size:14px;font-weight:600;text-align:right;">${typeof v === 'object' ? JSON.stringify(v) : v}</td></tr>`).join('')}
</table>`;
    }

    return `
<h2 style="margin:0 0 4px 0;font-size:22px;color:#1E293B;">${reportName}</h2>
<p style="margin:0 0 20px 0;font-size:14px;color:#94A3B8;">${businessName} — ${date} (Last 30 days)</p>
${dataRows}
<p style="margin:24px 0 0 0;font-size:12px;color:#CBD5E1;">This is an automated report from Booking OS. Manage your report schedules in Settings → Reports.</p>`;
  }
}
