import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@booking-os/db';

export type MockPrisma = DeepMockProxy<PrismaClient>;

export function createMockPrisma(): MockPrisma {
  return mockDeep<PrismaClient>();
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
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    }),
    markUsed: jest.fn().mockResolvedValue(undefined),
    revokeTokens: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockEmailService() {
  return {
    send: jest.fn().mockResolvedValue(true),
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendStaffInvitation: jest.fn().mockResolvedValue(true),
    sendBookingConfirmation: jest.fn().mockResolvedValue(true),
  };
}

export function createMockNotificationService() {
  return {
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendReminder: jest.fn().mockResolvedValue(undefined),
    sendFollowUp: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockBusinessService() {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'biz1', name: 'Test Clinic' }),
    getNotificationSettings: jest
      .fn()
      .mockResolvedValue({ channels: 'both', followUpDelayHours: 2 }),
    updateNotificationSettings: jest.fn().mockResolvedValue({}),
    getAiSettings: jest.fn().mockResolvedValue({}),
    updateAiSettings: jest.fn().mockResolvedValue({}),
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
  };
}

export function createMockConfigService() {
  const config: Record<string, string> = {
    JWT_SECRET: 'test-secret',
    JWT_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
    ANTHROPIC_API_KEY: 'test-key',
  };

  return {
    get: jest.fn((key: string, defaultValue?: string) => config[key] ?? defaultValue),
  };
}
