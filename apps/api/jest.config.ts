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
};

export default config;
