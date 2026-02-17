import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class RoiService {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private emailService: EmailService,
  ) {}

  async goLive(businessId: string) {
    const existing = await this.prisma.roiBaseline.findFirst({
      where: { businessId },
    });

    if (existing) {
      throw new BadRequestException('Business already has a baseline');
    }

    const now = new Date();
    const baselineEnd = new Date(now);
    const baselineStart = new Date(now);
    baselineStart.setDate(baselineStart.getDate() - 7);

    const [noShow, conversion, responseTimes, revenue, status] = await Promise.all([
      this.reportsService.noShowRate(businessId, 7, baselineStart, baselineEnd),
      this.reportsService.consultToTreatmentConversion(businessId, 7, baselineStart, baselineEnd),
      this.reportsService.responseTimes(businessId),
      this.reportsService.revenueOverTime(businessId, 7, baselineStart, baselineEnd),
      this.reportsService.statusBreakdown(businessId, 7, baselineStart, baselineEnd),
    ]);

    const totalRevenue = revenue.reduce((sum, d) => sum + d.revenue, 0);
    const completedBookings = status.find((s) => s.status === 'COMPLETED')?.count || 0;
    const avgBookingValue = completedBookings > 0 ? totalRevenue / completedBookings : 0;

    const metrics = {
      noShowRate: noShow.rate,
      noShowTotal: noShow.total,
      noShowCount: noShow.noShows,
      consultConversionRate: conversion.rate,
      consultCustomers: conversion.consultCustomers,
      consultConverted: conversion.converted,
      avgResponseMinutes: responseTimes.avgMinutes,
      responseSampleSize: responseTimes.sampleSize,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      completedBookings,
      avgBookingValue: Math.round(avgBookingValue * 100) / 100,
      statusBreakdown: status,
    };

    const baseline = await this.prisma.roiBaseline.create({
      data: {
        businessId,
        goLiveDate: now,
        baselineStart,
        baselineEnd,
        metrics,
      },
    });

    return baseline;
  }

  async getBaseline(businessId: string) {
    return this.prisma.roiBaseline.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoiDashboard(businessId: string, days: number = 30) {
    const baseline = await this.getBaseline(businessId);

    if (!baseline) {
      return { hasBaseline: false };
    }

    const baselineMetrics = baseline.metrics as any;

    const [noShow, conversion, responseTimes, revenue, status, depositCompliance] =
      await Promise.all([
        this.reportsService.noShowRate(businessId, days),
        this.reportsService.consultToTreatmentConversion(businessId, days),
        this.reportsService.responseTimes(businessId),
        this.reportsService.revenueOverTime(businessId, days),
        this.reportsService.statusBreakdown(businessId, days),
        this.reportsService.depositComplianceRate(businessId),
      ]);

    const totalRevenue = revenue.reduce((sum, d) => sum + d.revenue, 0);
    const completedBookings = status.find((s) => s.status === 'COMPLETED')?.count || 0;

    const current = {
      noShowRate: noShow.rate,
      noShowTotal: noShow.total,
      consultConversionRate: conversion.rate,
      avgResponseMinutes: responseTimes.avgMinutes,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      completedBookings,
      depositCompliance: depositCompliance.rate,
      revenueOverTime: revenue,
      statusBreakdown: status,
    };

    // Compute deltas (positive = improved)
    // For noShowRate and avgResponseMinutes, lower = better, so delta is inverted
    const deltas = {
      noShowRate: baselineMetrics.noShowRate - current.noShowRate, // positive = improved
      consultConversionRate: current.consultConversionRate - baselineMetrics.consultConversionRate,
      avgResponseMinutes: baselineMetrics.avgResponseMinutes - current.avgResponseMinutes, // positive = improved
      totalRevenue: current.totalRevenue - baselineMetrics.totalRevenue,
    };

    // Recovered revenue calculation (P1-17)
    const recoveredRevenue = this.computeRecoveredRevenue(baselineMetrics, current);

    return {
      hasBaseline: true,
      baseline: {
        goLiveDate: baseline.goLiveDate,
        baselineStart: baseline.baselineStart,
        baselineEnd: baseline.baselineEnd,
        metrics: baselineMetrics,
      },
      current,
      deltas,
      recoveredRevenue,
    };
  }

  private computeRecoveredRevenue(
    baselineMetrics: any,
    current: { noShowRate: number; noShowTotal: number; completedBookings: number },
  ) {
    const MIN_SAMPLE = 20;
    const baselineSample = baselineMetrics.noShowTotal || 0;
    const currentSample = current.noShowTotal || 0;

    // Insufficient data check
    if (baselineSample < MIN_SAMPLE || currentSample < MIN_SAMPLE) {
      return {
        amount: null,
        sufficient: false,
        reason: 'insufficient_data',
        formula: null,
      };
    }

    const noShowImprovement = baselineMetrics.noShowRate - current.noShowRate;

    // No improvement
    if (noShowImprovement <= 0) {
      return {
        amount: null,
        sufficient: true,
        reason: 'no_improvement',
        formula: null,
      };
    }

    const avgBookingValue = baselineMetrics.avgBookingValue || 0;
    const amount =
      Math.round((noShowImprovement / 100) * current.completedBookings * avgBookingValue * 100) /
      100;

    return {
      amount,
      sufficient: true,
      reason: null,
      formula: {
        baselineNoShowRate: baselineMetrics.noShowRate,
        currentNoShowRate: current.noShowRate,
        noShowImprovement,
        completedBookings: current.completedBookings,
        avgBookingValue,
      },
    };
  }

  async getWeeklyReview(businessId: string) {
    const now = new Date();
    const thisWeekEnd = new Date(now);
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const [thisWeekData, lastWeekData] = await Promise.all([
      this.fetchPeriodMetrics(businessId, thisWeekStart, thisWeekEnd),
      this.fetchPeriodMetrics(businessId, lastWeekStart, lastWeekEnd),
    ]);

    // Compute deltas — positive = improved
    // For noShowRate and avgResponseMinutes: lower = better, so delta is inverted
    const weekDelta = {
      noShowRate: lastWeekData.noShowRate - thisWeekData.noShowRate,
      consultConversionRate:
        thisWeekData.consultConversionRate - lastWeekData.consultConversionRate,
      avgResponseMinutes: lastWeekData.avgResponseMinutes - thisWeekData.avgResponseMinutes,
      totalRevenue: thisWeekData.totalRevenue - lastWeekData.totalRevenue,
      completedBookings: thisWeekData.completedBookings - lastWeekData.completedBookings,
      depositCompliance: thisWeekData.depositCompliance - lastWeekData.depositCompliance,
    };

    // Calculate week number (ISO week)
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    );

    return {
      thisWeek: thisWeekData,
      lastWeek: lastWeekData,
      weekDelta,
      weekNumber,
      dateRange: {
        start: thisWeekStart.toISOString(),
        end: thisWeekEnd.toISOString(),
      },
      generatedAt: now.toISOString(),
    };
  }

  private async fetchPeriodMetrics(businessId: string, start: Date, end: Date) {
    const [noShow, conversion, responseTimes, revenue, status, depositCompliance] =
      await Promise.all([
        this.reportsService.noShowRate(businessId, 7, start, end),
        this.reportsService.consultToTreatmentConversion(businessId, 7, start, end),
        this.reportsService.responseTimes(businessId),
        this.reportsService.revenueOverTime(businessId, 7, start, end),
        this.reportsService.statusBreakdown(businessId, 7, start, end),
        this.reportsService.depositComplianceRate(businessId),
      ]);

    const totalRevenue = revenue.reduce((sum, d) => sum + d.revenue, 0);
    const completedBookings = status.find((s) => s.status === 'COMPLETED')?.count || 0;

    return {
      noShowRate: noShow.rate,
      consultConversionRate: conversion.rate,
      avgResponseMinutes: responseTimes.avgMinutes,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      completedBookings,
      depositCompliance: depositCompliance.rate,
    };
  }

  async emailWeeklyReview(businessId: string, recipientEmail: string, recipientName: string) {
    const review = await this.getWeeklyReview(businessId);

    const formatDelta = (val: number, invertColor = false) => {
      const improved = invertColor ? val < 0 : val > 0;
      const color = improved ? '#71907C' : val === 0 ? '#64748b' : '#ef4444';
      const sign = val > 0 ? '+' : '';
      return `<span style="color:${color};font-weight:600">${sign}${Math.round(val * 100) / 100}</span>`;
    };

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="font-family:Georgia,serif;color:#1e293b">Week ${review.weekNumber} Review</h2>
        <p style="color:#64748b;font-size:14px">${new Date(review.dateRange.start).toLocaleDateString()} — ${new Date(review.dateRange.end).toLocaleDateString()}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
          <thead>
            <tr style="border-bottom:2px solid #e2e8f0">
              <th style="text-align:left;padding:8px;color:#64748b">Metric</th>
              <th style="text-align:right;padding:8px;color:#64748b">This Week</th>
              <th style="text-align:right;padding:8px;color:#64748b">Last Week</th>
              <th style="text-align:right;padding:8px;color:#64748b">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:8px">No-show rate</td>
              <td style="padding:8px;text-align:right">${review.thisWeek.noShowRate}%</td>
              <td style="padding:8px;text-align:right">${review.lastWeek.noShowRate}%</td>
              <td style="padding:8px;text-align:right">${formatDelta(review.weekDelta.noShowRate)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:8px">Consult conversion</td>
              <td style="padding:8px;text-align:right">${review.thisWeek.consultConversionRate}%</td>
              <td style="padding:8px;text-align:right">${review.lastWeek.consultConversionRate}%</td>
              <td style="padding:8px;text-align:right">${formatDelta(review.weekDelta.consultConversionRate)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:8px">Avg response time</td>
              <td style="padding:8px;text-align:right">${review.thisWeek.avgResponseMinutes}m</td>
              <td style="padding:8px;text-align:right">${review.lastWeek.avgResponseMinutes}m</td>
              <td style="padding:8px;text-align:right">${formatDelta(review.weekDelta.avgResponseMinutes)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:8px">Revenue</td>
              <td style="padding:8px;text-align:right">$${review.thisWeek.totalRevenue}</td>
              <td style="padding:8px;text-align:right">$${review.lastWeek.totalRevenue}</td>
              <td style="padding:8px;text-align:right">${formatDelta(review.weekDelta.totalRevenue)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:8px">Completed bookings</td>
              <td style="padding:8px;text-align:right">${review.thisWeek.completedBookings}</td>
              <td style="padding:8px;text-align:right">${review.lastWeek.completedBookings}</td>
              <td style="padding:8px;text-align:right">${formatDelta(review.weekDelta.completedBookings)}</td>
            </tr>
            <tr>
              <td style="padding:8px">Deposit compliance</td>
              <td style="padding:8px;text-align:right">${review.thisWeek.depositCompliance}%</td>
              <td style="padding:8px;text-align:right">${review.lastWeek.depositCompliance}%</td>
              <td style="padding:8px;text-align:right">${formatDelta(review.weekDelta.depositCompliance)}</td>
            </tr>
          </tbody>
        </table>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Generated ${new Date(review.generatedAt).toLocaleString()} — Booking OS</p>
      </div>
    `;

    await this.emailService.send({
      to: recipientEmail,
      subject: `Week ${review.weekNumber} Review — Booking OS`,
      html,
    });

    return { sent: true };
  }
}
