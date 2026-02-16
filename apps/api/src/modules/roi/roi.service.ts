import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class RoiService {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
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
    const recoveredRevenue = this.computeRecoveredRevenue(
      baselineMetrics,
      current,
    );

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
    const amount = Math.round(
      (noShowImprovement / 100) * current.completedBookings * avgBookingValue * 100,
    ) / 100;

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
}
