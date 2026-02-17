import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@booking-os/shared$': '<rootDir>/../../packages/shared/src/index',
    '^@booking-os/messaging-provider$': '<rootDir>/../../packages/messaging-provider/src/index',
    '^@booking-os/db$': '<rootDir>/../../packages/db/src/index',
  },
  coveragePathIgnorePatterns: ['prisma.service.ts', 'queue.module.ts'],
  coverageThreshold: {
    global: {
      lines: 90,
      statements: 90,
      functions: 85,
      branches: 78,
    },
  },
  // Limit workers to avoid SIGSEGV during coverage runs
  maxWorkers: '50%',
};

export default config;
