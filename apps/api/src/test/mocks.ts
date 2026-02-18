import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@booking-os/db';

export type MockPrisma = DeepMockProxy<PrismaClient>;

export function createMockPrisma(): MockPrisma {
  const prisma = mockDeep<PrismaClient>();
  // Make $transaction execute callbacks with the mock itself as tx
  // This supports interactive transactions used in security-critical operations
  (prisma.$transaction as jest.Mock).mockImplementation(async (fnOrArray: any) => {
    if (typeof fnOrArray === 'function') {
      return fnOrArray(prisma);
    }
    return fnOrArray;
  });
  return prisma;
}

export function createMockClaudeClient() {
  return {
    isAvailable: jest.fn().mockReturnValue(true),
    complete: jest.fn().mockResolvedValue('{}'),
  };
}

export function createMockTokenService() {
  return {
    createToken: jest.fn().mockResolvedValue('mock-token-hex'),
    validateToken: jest.fn().mockResolvedValue({
      id: 'token1',
      token: 'mock-token-hex',
      type: 'PASSWORD_RESET',
      email: 'test@test.com',
      businessId: 'biz1',
      staffId: 'staff1',
      bookingId: null,
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    }),
    markUsed: jest.fn().mockResolvedValue(undefined),
    revokeTokens: jest.fn().mockResolvedValue(undefined),
    revokeBookingTokens: jest.fn().mockResolvedValue(undefined),
    revokeAllTokensForEmail: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockEmailService() {
  return {
    send: jest.fn().mockResolvedValue(true),
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendStaffInvitation: jest.fn().mockResolvedValue(true),
    sendBookingConfirmation: jest.fn().mockResolvedValue(true),
    sendEmailVerification: jest.fn().mockResolvedValue(true),
  };
}

export function createMockNotificationService() {
  return {
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendReminder: jest.fn().mockResolvedValue(undefined),
    sendFollowUp: jest.fn().mockResolvedValue(undefined),
    sendConsultFollowUp: jest.fn().mockResolvedValue(undefined),
    sendAftercare: jest.fn().mockResolvedValue(undefined),
    sendTreatmentCheckIn: jest.fn().mockResolvedValue(undefined),
    sendDepositRequest: jest.fn().mockResolvedValue(undefined),
    sendRescheduleLink: jest.fn().mockResolvedValue(undefined),
    sendCancelLink: jest.fn().mockResolvedValue(undefined),
    sendCancellationNotification: jest.fn().mockResolvedValue(undefined),
    sendKanbanStatusUpdate: jest.fn().mockResolvedValue(undefined),
    sendQuoteApprovalRequest: jest.fn().mockResolvedValue(undefined),
    logNotificationEvent: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockBusinessService() {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'biz1', name: 'Test Clinic', slug: 'test-clinic' }),
    getNotificationSettings: jest.fn().mockResolvedValue({
      channels: 'both',
      followUpDelayHours: 2,
      consultFollowUpDays: 3,
      treatmentCheckInHours: 24,
    }),
    updateNotificationSettings: jest.fn().mockResolvedValue({}),
    getAiSettings: jest.fn().mockResolvedValue({}),
    updateAiSettings: jest.fn().mockResolvedValue({}),
    getPolicySettings: jest.fn().mockResolvedValue({
      cancellationWindowHours: 24,
      rescheduleWindowHours: 24,
      cancellationPolicyText: '',
      reschedulePolicyText: '',
      policyEnabled: false,
    }),
    updatePolicySettings: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
}

export function createMockCalendarSyncService() {
  return {
    syncBookingToCalendar: jest.fn().mockResolvedValue(undefined),
    getConnections: jest.fn().mockResolvedValue([]),
    getAvailableProviders: jest.fn().mockReturnValue({ google: false, outlook: false }),
    initiateOAuth: jest.fn().mockResolvedValue('https://example.com/auth'),
    handleOAuthCallback: jest.fn().mockResolvedValue('https://example.com/callback'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    generateIcalFeed: jest.fn().mockResolvedValue(null),
    getIcalFeedUrl: jest.fn().mockResolvedValue(null),
    regenerateIcalToken: jest.fn().mockResolvedValue('https://example.com/ical/new.ics'),
    pullExternalEvents: jest.fn().mockResolvedValue([]),
  };
}

export function createMockConfigService() {
  const config: Record<string, string> = {
    JWT_SECRET: 'test-secret',
    JWT_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
    ANTHROPIC_API_KEY: 'test-key',
    WEB_URL: 'http://localhost:3000',
  };

  return {
    get: jest.fn((key: string, defaultValue?: string) => config[key] ?? defaultValue),
  };
}

export function createMockReportsService() {
  return {
    bookingsOverTime: jest.fn().mockResolvedValue([]),
    noShowRate: jest.fn().mockResolvedValue({ total: 50, noShows: 5, rate: 10 }),
    responseTimes: jest.fn().mockResolvedValue({ avgMinutes: 8, sampleSize: 30 }),
    serviceBreakdown: jest.fn().mockResolvedValue([]),
    staffPerformance: jest.fn().mockResolvedValue([]),
    revenueOverTime: jest.fn().mockResolvedValue([{ date: '2026-02-01', revenue: 500 }]),
    statusBreakdown: jest.fn().mockResolvedValue([
      { status: 'COMPLETED', count: 30 },
      { status: 'NO_SHOW', count: 5 },
    ]),
    consultToTreatmentConversion: jest.fn().mockResolvedValue({
      consultCustomers: 10,
      converted: 6,
      rate: 60,
    }),
    depositComplianceRate: jest.fn().mockResolvedValue({
      totalRequired: 15,
      paid: 12,
      rate: 80,
    }),
    peakHours: jest.fn().mockResolvedValue({ byHour: [], byDay: [] }),
  };
}

export function createMockWaitlistService() {
  return {
    joinWaitlist: jest.fn().mockResolvedValue({
      id: 'wl1',
      businessId: 'biz1',
      customerId: 'cust1',
      serviceId: 'svc1',
      status: 'ACTIVE',
      service: { name: 'Botox Treatment' },
      customer: { name: 'Emma Wilson' },
    }),
    getEntries: jest.fn().mockResolvedValue([]),
    updateEntry: jest.fn().mockResolvedValue({ id: 'wl1', status: 'ACTIVE' }),
    cancelEntry: jest.fn().mockResolvedValue({ id: 'wl1', status: 'CANCELLED' }),
    resolveEntry: jest.fn().mockResolvedValue({ id: 'wl1', status: 'BOOKED', bookingId: 'book1' }),
    offerOpenSlot: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest
      .fn()
      .mockResolvedValue({ cancellations: 5, offers: 3, claimed: 2, avgTimeToFill: 45 }),
    expireStaleOffers: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockActionHistoryService() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'ah1' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    findByEntity: jest.fn().mockResolvedValue([]),
  };
}

export function createMockAvailabilityService() {
  return {
    getAvailableSlots: jest.fn().mockResolvedValue([
      {
        time: '2026-03-01T10:00:00Z',
        display: '10:00',
        staffId: 'staff1',
        staffName: 'Dr. Chen',
        available: true,
      },
      {
        time: '2026-03-01T10:30:00Z',
        display: '10:30',
        staffId: 'staff1',
        staffName: 'Dr. Chen',
        available: true,
      },
    ]),
    getStaffWorkingHours: jest.fn().mockResolvedValue([]),
    setStaffWorkingHours: jest.fn().mockResolvedValue([]),
    getStaffTimeOff: jest.fn().mockResolvedValue([]),
    addTimeOff: jest.fn().mockResolvedValue({}),
    removeTimeOff: jest.fn().mockResolvedValue({}),
  };
}
