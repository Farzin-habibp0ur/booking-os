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
  coverageThreshold: {
    global: {
      lines: 70,
      statements: 70,
      functions: 50,
      branches: 50,
    },
  },
  // Limit workers to avoid SIGSEGV during coverage runs
  maxWorkers: '50%',
};

export default config;
