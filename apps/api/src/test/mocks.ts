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
